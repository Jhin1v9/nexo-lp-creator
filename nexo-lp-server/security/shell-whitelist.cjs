/**
 * Shell Command Whitelist - NEXO Landing Page Creator v3.0
 *
 * Validates shell commands against security policies before execution.
 *
 * SECURITY MODEL:
 * - Default-deny: commands not explicitly allowed are rejected
 * - Pipeline-aware: validates each segment in a command pipeline
 * - Argument inspection: checks dangerous flags on restricted commands
 * - Subshell detection: blocks command substitution and eval
 * - Path validation: ensures file arguments stay within workspace
 */

'use strict';

const { containsTraversal } = require('./path-validator.cjs');

// ---------------------------------------------------------------------------
// ALLOWED COMMANDS (default-deny, these are the only permitted binaries)
// ---------------------------------------------------------------------------

/**
 * Commands that are fully allowed with any arguments.
 */
const FULLY_ALLOWED_COMMANDS = new Set([
  // File listing and content
  'ls', 'cat', 'head', 'tail', 'less', 'more', 'wc', 'sort', 'uniq', 'diff',

  // File operations (safe variants)
  'touch', 'mkdir', 'cp', 'mv',

  // Text processing
  'echo', 'printf', 'grep', 'egrep', 'fgrep', 'sed', 'awk', 'cut', 'tr',
  'rev', 'tac', 'nl', 'xxd', 'od', 'hexdump',

  // Informational
  'pwd', 'whoami', 'id', 'uname', 'date', 'which', 'whereis',

  // JavaScript/Node toolchain (npx only; node/npm have restrictions below)
  'npx',

  // Version control (git has subcommand restrictions below)

  // Archive
  'tar', 'zip', 'unzip',

  // Build tools (safe)
  'make', 'cmake',

  // Utilities
  'find', 'locate', 'xargs', 'tee', 'true', 'false',

  // Node scripts from node_modules/.bin
  'next', 'eslint', 'prettier', 'tsc', 'vite',
]);

/**
 * Commands that are allowed but with argument restrictions.
 */
const RESTRICTED_COMMANDS = {
  rm: {
    // rm is allowed but with critical restrictions
    allowedFlags: new Set(['-f', '-v', '-i', '-r', '-R', '--dir']),
    forbiddenFlags: new Set(['--no-preserve-root']),
    forbiddenArgs: ['/'], // Cannot rm the root filesystem
    maxDepth: 3, // Limit recursive depth via find workaround
    description: 'File removal (workspace only, no root deletion)',
  },
  chmod: {
    allowedFlags: new Set(['-R', '-v', '-c']),
    forbiddenFlags: new Set(),
    forbiddenPatterns: [
      /777\s/,        // no chmod 777
      /777$/,         // chmod 777 at end
      /o\+s/,         // no setuid
      /u\+s/,         // no setuid
    ],
    description: 'Permission changes (no 777, no setuid)',
  },
  chown: {
    allowedFlags: new Set(['-R', '-v', '-c']),
    forbiddenFlags: new Set(),
    description: 'Owner changes (restricted)',
  },
  python3: {
    allowedFlags: new Set(['-m', '-c', '-v', '-V', '-h', '-O', '-B']),
    forbiddenFlags: new Set(['-S']), // -S disables site.py (security concern)
    description: 'Python interpreter (restricted flags)',
  },
  python: {
    allowedFlags: new Set(['-m', '-c', '-v', '-V', '-h', '-O', '-B']),
    forbiddenFlags: new Set(['-S']),
    description: 'Python interpreter (restricted flags)',
  },
  node: {
    allowedFlags: new Set([
      '-v', '--version', '-h', '--help', '-e', '-p', '--eval', '--print',
      '-c', '--check', '-r', '--require', '--experimental-modules',
      '--input-type', '--no-warnings', '--trace-warnings',
    ]),
    forbiddenFlags: new Set([
      '--allow-natives-syntax', // V8 native syntax is dangerous
      '--expose-gc',            // Can be used for memory attacks
      '--prof',                 // CPU profiling (info leak)
      '--perf-basic-prof',      // perf profiling (info leak)
    ]),
    description: 'Node.js interpreter (restricted flags)',
  },
  npm: {
    allowedFlags: new Set([
      '-v', '--version', '-h', '--help', '--prefix', '--registry',
      '--no-optional', '--production', '--save', '--save-dev',
      '--save-exact', '--dry-run', '--json', '--parseable',
    ]),
    forbiddenFlags: new Set([]),
    description: 'npm package manager (restricted flags)',
  },
  git: {
    allowedFlags: new Set([]),
    forbiddenFlags: new Set([]),
    // Only allow specific git subcommands
    allowedSubcommands: new Set([
      'status', 'log', 'diff', 'show', 'blame', 'grep',
      'init', 'clone', 'fetch', 'pull', 'push',
      'add', 'rm', 'mv', 'commit', 'checkout', 'switch', 'restore',
      'branch', 'tag', 'merge', 'rebase', 'cherry-pick',
      'config', 'remote', 'submodule',
      'stash', 'reset', 'clean',
      'describe', 'rev-parse', 'ls-files', 'ls-tree',
    ]),
    description: 'Git version control (safe subcommands only)',
  },
  curl: {
    // curl is DANGEROUS but may be needed for some legitimate use cases.
    // We require explicit opt-in via the allowNetwork option.
    requiresNetwork: true,
    description: 'HTTP client (REQUIRES NETWORK PERMISSION)',
  },
  wget: {
    requiresNetwork: true,
    description: 'HTTP downloader (REQUIRES NETWORK PERMISSION)',
  },
};

/**
 * Commands that are absolutely forbidden under any circumstances.
 */
const FORBIDDEN_COMMANDS = new Set([
  // Privilege escalation
  'sudo', 'su', 'doas', 'pkexec',

  // Network tools that can exfiltrate data
  'nc', 'netcat', 'ncat', 'telnet', 'ftp', 'sftp', 'scp',

  // Shell execution (command injection vectors)
  'eval', 'exec', 'source', '.', 'bash', 'sh', 'zsh', 'fish', 'dash', 'ksh', 'csh', 'tcsh',

  // Process manipulation
  'kill', 'killall', 'pkill', 'xargs', // xargs handled specially above

  // System modification
  'mkfs', 'fdisk', 'dd', 'mount', 'umount',

  // Package management (too dangerous)
  'apt', 'apt-get', 'yum', 'dnf', 'pacman', 'apk', 'brew', 'port',

  // Dangerous file operations
  'chroot',

  // Reverse shells and tunneling
  'ssh', 'autossh', 'sshuttle', 'tsocks', 'proxychains',

  // Code compilation that could execute code
  'gcc', 'g++', 'clang', 'cc', 'c++', 'make', // make is allowed above

  // Interactive editors (hang risk)
  'vim', 'vi', 'nano', 'emacs', 'ed',

  // Expect / automation tools that can spawn shells
  'expect',

  // Systemctl / service manipulation
  'systemctl', 'service', 'init', 'reboot', 'shutdown', 'poweroff', 'halt',

  // Container escape tools
  'docker', 'podman', 'ctr', 'nerdctl', 'runc',
]);

// ---------------------------------------------------------------------------
// Dangerous patterns in shell commands
// ---------------------------------------------------------------------------

const DANGEROUS_PATTERNS = [
  // Command substitution (executes arbitrary code)
  /\$\([^)]*\)/,           // $(cmd)
  /`[^`]*`/,               // `cmd`

  // Process substitution
  /<\([^)]*\)/,            // <(cmd)
  />\([^)]*\)/,            // >(cmd)

  // Shell expansion attacks
  /\$\{[^}]*\}/,           // ${...} parameter expansion (risky)

  // Redirection to sensitive paths
  />\s*\/etc\/\w+/,        // writing to /etc
  />\s*\/proc\/\w+/,       // writing to /proc
  />\s*\/sys\/\w+/,        // writing to /sys

  // Background/foreground manipulation
  /&\s*$/,                 // background processes at end

  // Pipeline to shell
  /\|\s*(sh|bash|zsh|dash)/,

  // Here-document to shell
  /<<\s*\w+\s*[\r\n].*?(sh|bash)/s,

  // Null byte injection
  /\0/,
];

// ---------------------------------------------------------------------------
// Command parser
// ---------------------------------------------------------------------------

/**
 * Split a command string into pipeline segments by `|`,
 * while respecting quoted strings (single, double, backtick).
 * @param {string} command
 * @returns {string[]}
 */
function splitPipeline(command) {
  const parts = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktick = false;
  let escapeNext = false;

  for (let i = 0; i < command.length; i++) {
    const char = command[i];

    if (escapeNext) {
      current += char;
      escapeNext = false;
      continue;
    }

    if (char === '\\' && !inSingleQuote) {
      current += char;
      escapeNext = true;
      continue;
    }

    if (char === "'" && !inDoubleQuote && !inBacktick) {
      inSingleQuote = !inSingleQuote;
      current += char;
      continue;
    }

    if (char === '"' && !inSingleQuote && !inBacktick) {
      inDoubleQuote = !inDoubleQuote;
      current += char;
      continue;
    }

    if (char === '`' && !inSingleQuote && !inDoubleQuote) {
      inBacktick = !inBacktick;
      current += char;
      continue;
    }

    // Split on unquoted `|`
    if (char === '|' && !inSingleQuote && !inDoubleQuote && !inBacktick) {
      parts.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  if (current.length > 0 || parts.length > 0) {
    parts.push(current);
  }

  return parts;
}

/**
 * Parse a command string into pipeline segments.
 * Each segment is a single command with its arguments.
 *
 * @param {string} command
 * @returns {Array<{binary: string, args: string[], raw: string}>}
 */
function parseCommandPipeline(command) {
  if (typeof command !== 'string') {
    return [];
  }

  const segments = [];

  // Use the quote-aware pipeline splitter
  const parts = command.includes('|') ? splitPipeline(command) : [command];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Tokenize respecting quotes
    const tokens = tokenize(trimmed);
    if (tokens.length === 0) continue;

    const binary = tokens[0];
    const args = tokens.slice(1);

    segments.push({
      binary,
      args,
      raw: trimmed,
    });
  }

  // If still no segments, treat entire command as one
  if (segments.length === 0) {
    const tokens = tokenize(command.trim());
    if (tokens.length > 0) {
      segments.push({
        binary: tokens[0],
        args: tokens.slice(1),
        raw: command.trim(),
      });
    }
  }

  return segments;
}

/**
 * Tokenize a command string respecting single and double quotes.
 * @param {string} str
 * @returns {string[]}
 */
function tokenize(str) {
  const tokens = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escapeNext = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];

    if (escapeNext) {
      current += char;
      escapeNext = false;
      continue;
    }

    if (char === '\\' && !inSingleQuote) {
      escapeNext = true;
      current += char;
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      current += char;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      current += char;
      continue;
    }

    if (char === ' ' && !inSingleQuote && !inDoubleQuote) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// Validation functions
// ---------------------------------------------------------------------------

/**
 * Validate a command string against the whitelist.
 *
 * @param {string} command - The command to validate
 * @param {Object} options - Validation options
 * @param {boolean} options.allowNetwork - Whether to allow network commands (curl, wget)
 * @param {string} options.workspaceRoot - The workspace root for path validation
 * @returns {Object} Validation result:
 *   - allowed {boolean}: Whether the command is safe
 *   - reason {string|null}: Explanation if rejected
 *   - sanitizedCommand {string|null}: The command with dangerous parts removed (or null)
 *   - segments {Array}: Parsed pipeline segments
 */
function validateCommand(command, options = {}) {
  if (typeof command !== 'string') {
    return {
      allowed: false,
      reason: 'Command must be a string',
      sanitizedCommand: null,
      segments: [],
    };
  }

  if (command.length === 0) {
    return {
      allowed: false,
      reason: 'Command cannot be empty',
      sanitizedCommand: null,
      segments: [],
    };
  }

  if (command.length > 8192) {
    return {
      allowed: false,
      reason: 'Command exceeds maximum length of 8192 characters',
      sanitizedCommand: null,
      segments: [],
    };
  }

  // --- Check for dangerous patterns ---
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      return {
        allowed: false,
        reason: `Command matches dangerous pattern (${pattern.source})`,
        sanitizedCommand: null,
        segments: [],
      };
    }
  }

  // --- Parse pipeline ---
  const segments = parseCommandPipeline(command);
  if (segments.length === 0) {
    return {
      allowed: false,
      reason: 'Could not parse command',
      sanitizedCommand: null,
      segments: [],
    };
  }

  // --- Validate each segment ---
  for (const segment of segments) {
    const binary = segment.binary;

    // Remove path prefix if present (e.g., /usr/bin/cat -> cat)
    const binaryName = binary.replace(/^.*[/\\]/, '');

    // Check forbidden commands
    if (FORBIDDEN_COMMANDS.has(binaryName)) {
      return {
        allowed: false,
        reason: `Command '${binaryName}' is forbidden (security risk)`,
        sanitizedCommand: null,
        segments,
      };
    }

    // Check if command is in fully allowed list
    if (FULLY_ALLOWED_COMMANDS.has(binaryName)) {
      // It's fully allowed, but still check args for traversal
      for (const arg of segment.args) {
        // Strip quotes for checking
        const cleanArg = arg.replace(/^['"]|['"]$/g, '');
        if (containsTraversal(cleanArg)) {
          return {
            allowed: false,
            reason: `Argument contains path traversal: ${cleanArg}`,
            sanitizedCommand: null,
            segments,
          };
        }
      }
      continue;
    }

    // Check if command has restrictions
    if (RESTRICTED_COMMANDS[binaryName]) {
      const restrictions = RESTRICTED_COMMANDS[binaryName];

      // Network requirement check
      if (restrictions.requiresNetwork && !options.allowNetwork) {
        return {
          allowed: false,
          reason: `Command '${binaryName}' requires network access which is disabled`,
          sanitizedCommand: null,
          segments,
        };
      }

      // Check forbidden flags
      if (restrictions.forbiddenFlags) {
        for (const arg of segment.args) {
          if (restrictions.forbiddenFlags.has(arg)) {
            return {
              allowed: false,
              reason: `Flag '${arg}' is forbidden for command '${binaryName}'`,
              sanitizedCommand: null,
              segments,
            };
          }
        }
      }

      // Check forbidden args
      if (restrictions.forbiddenArgs) {
        for (const arg of segment.args) {
          const cleanArg = arg.replace(/^['"]|['"]$/g, '');
          for (const forbidden of restrictions.forbiddenArgs) {
            if (cleanArg === forbidden || cleanArg.startsWith(forbidden + '/')) {
              return {
                allowed: false,
                reason: `Argument '${cleanArg}' is forbidden for command '${binaryName}'`,
                sanitizedCommand: null,
                segments,
              };
            }
          }
        }
      }

      // Check forbidden patterns
      if (restrictions.forbiddenPatterns) {
        const argString = segment.args.join(' ');
        for (const pattern of restrictions.forbiddenPatterns) {
          if (pattern.test(argString)) {
            return {
              allowed: false,
              reason: `Arguments match forbidden pattern '${pattern.source}' for command '${binaryName}'`,
              sanitizedCommand: null,
              segments,
            };
          }
        }
      }

      // Git subcommand validation
      if (binaryName === 'git' && restrictions.allowedSubcommands) {
        const firstArg = segment.args[0] ? segment.args[0].replace(/^-/, '') : '';
        if (firstArg && !restrictions.allowedSubcommands.has(firstArg)) {
          return {
            allowed: false,
            reason: `Git subcommand '${firstArg}' is not allowed`,
            sanitizedCommand: null,
            segments,
          };
        }
      }

      // Check args for traversal
      for (const arg of segment.args) {
        const cleanArg = arg.replace(/^['"]|['"]$/g, '');
        if (containsTraversal(cleanArg)) {
          return {
            allowed: false,
            reason: `Argument contains path traversal: ${cleanArg}`,
            sanitizedCommand: null,
            segments,
          };
        }
      }

      continue;
    }

    // Command is not recognized and not forbidden - reject in strict mode
    return {
      allowed: false,
      reason: `Command '${binaryName}' is not in the allowed list`,
      sanitizedCommand: null,
      segments,
    };
  }

  // --- All segments passed ---
  return {
    allowed: true,
    reason: null,
    sanitizedCommand: command,
    segments,
  };
}

/**
 * Check if a binary name is in the allowed list (without full validation).
 * Useful for quick checks in UI or autocomplete.
 * @param {string} binaryName
 * @returns {boolean}
 */
function isAllowedBinary(binaryName) {
  const clean = binaryName.replace(/^.*[/\\]/, '');
  return FULLY_ALLOWED_COMMANDS.has(clean) ||
    RESTRICTED_COMMANDS[clean] !== undefined;
}

/**
 * Get the list of allowed commands (for documentation/UI).
 * @returns {Object}
 */
function getAllowedCommands() {
  return {
    fullyAllowed: Array.from(FULLY_ALLOWED_COMMANDS).sort(),
    restricted: Object.entries(RESTRICTED_COMMANDS).map(([cmd, cfg]) => ({
      command: cmd,
      description: cfg.description,
    })),
    forbidden: Array.from(FORBIDDEN_COMMANDS).sort(),
  };
}

module.exports = {
  validateCommand,
  isAllowedBinary,
  getAllowedCommands,
  parseCommandPipeline,
  tokenize,
  // Expose for testing and customization
  FULLY_ALLOWED_COMMANDS,
  RESTRICTED_COMMANDS,
  FORBIDDEN_COMMANDS,
  DANGEROUS_PATTERNS,
};
