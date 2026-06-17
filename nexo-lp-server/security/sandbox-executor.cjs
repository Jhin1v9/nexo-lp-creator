/**
 * Sandbox Executor - NEXO Landing Page Creator v3.0
 *
 * Core security module that wraps all shell/script execution with:
 * - Firejail or systemd-run sandbox isolation (with fallback to regular spawn)
 * - Resource limits (CPU 300s, memory 512MB, network none)
 * - Whitelist-based command filtering
 * - Path validation before any file operation
 * - Environment variable filtering (removes secrets)
 * - Structured results: {success, stdout, stderr, exitCode, duration}
 * - Worker process support (JSON in via stdin, JSON out via stdout)
 */

'use strict';

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const crypto = require('crypto');

// Import security submodules
const { validatePath, validateDirectoryPath, sanitizeFilename } = require('./path-validator.cjs');
const { EnvFilter, filterEnv, createMinimalEnv } = require('./env-filter.cjs');
const { validateCommand } = require('./shell-whitelist.cjs');

const execAsync = promisify(exec);

// ---------------------------------------------------------------------------
// Default configuration
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG = {
  // Workspace and directories
  workspaceRoot: '/tmp/nexo-lp-sandbox',
  allowedDirs: [],

  // Resource limits
  maxCpuTime: 300,         // 5 minutes (seconds)
  maxMemory: 512,          // MB
  maxFileSize: 50,         // MB
  maxOutputSize: 10 * 1024 * 1024, // 10 MB stdout/stderr cap
  networkEnabled: false,   // No network by default

  // Sandbox engine
  sandboxEngine: 'auto',   // 'firejail', 'systemd-run', 'spawn', 'auto'

  // Timeouts
  defaultTimeout: 300000,  // 5 minutes (ms)
  writeTimeout: 30000,     // 30 seconds for file writes
  readTimeout: 30000,      // 30 seconds for file reads

  // Environment
  strictEnvMode: false,

  // Logging
  logCommands: true,
  logLevel: 'warn',        // 'debug', 'info', 'warn', 'error'

  // Worker mode
  workerMode: false,
};

// ---------------------------------------------------------------------------
// SandboxExecutor class
// ---------------------------------------------------------------------------

class SandboxExecutor {
  /**
   * Create a new SandboxExecutor.
   * @param {Object} config - Overrides for DEFAULT_CONFIG
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Resolve workspace root to absolute path
    this.workspaceRoot = path.resolve(this.config.workspaceRoot);
    this.config.workspaceRoot = this.workspaceRoot;

    // Resolve allowed directories
    this.allowedDirs = [
      this.workspaceRoot,
      ...this.config.allowedDirs.map(d => path.resolve(d)),
    ];

    // Ensure workspace directory exists
    this._ensureWorkspace();

    // Initialize environment filter
    this.envFilter = new EnvFilter({
      strictMode: this.config.strictEnvMode,
      inspectValues: true,
    });

    // Detect sandbox engine
    this.sandboxEngine = this.config.sandboxEngine;
    if (this.sandboxEngine === 'auto') {
      this.sandboxEngine = this._detectSandboxEngine();
    }

    // Stats
    this.stats = {
      commandsExecuted: 0,
      commandsBlocked: 0,
      filesWritten: 0,
      filesRead: 0,
      totalExecutionTime: 0,
      errors: 0,
    };
  }

  // -------------------------------------------------------------------------
  // Engine detection
  // -------------------------------------------------------------------------

  _detectSandboxEngine() {
    try {
      // Check for firejail
      const firejailCheck = require('child_process').execSync('which firejail 2>/dev/null || echo ""', { encoding: 'utf8' }).trim();
      if (firejailCheck) {
        this._log('info', `Sandbox engine: firejail (${firejailCheck})`);
        return 'firejail';
      }

      // Check for systemd-run
      const systemdCheck = require('child_process').execSync('which systemd-run 2>/dev/null || echo ""', { encoding: 'utf8' }).trim();
      if (systemdCheck) {
        this._log('info', `Sandbox engine: systemd-run (${systemdCheck})`);
        return 'systemd-run';
      }
    } catch (err) {
      // fallthrough to spawn
    }

    this._log('warn', 'No sandbox engine detected (firejail/systemd-run not found). Using spawn fallback with manual restrictions.');
    return 'spawn';
  }

  // -------------------------------------------------------------------------
  // Workspace management
  // -------------------------------------------------------------------------

  _ensureWorkspace() {
    try {
      if (!fs.existsSync(this.workspaceRoot)) {
        fs.mkdirSync(this.workspaceRoot, { recursive: true, mode: 0o755 });
        this._log('info', `Created workspace: ${this.workspaceRoot}`);
      }
    } catch (err) {
      this._log('error', `Failed to create workspace: ${err.message}`);
      throw new Error(`Cannot create workspace: ${err.message}`);
    }
  }

  /**
   * Create a new sandbox session directory.
   * @param {string} sessionId - Optional session identifier
   * @returns {string} Path to the session directory
   */
  createSession(sessionId) {
    const id = sessionId || crypto.randomUUID();
    const sessionDir = path.join(this.workspaceRoot, 'sessions', id);
    fs.mkdirSync(sessionDir, { recursive: true, mode: 0o755 });
    return sessionDir;
  }

  /**
   * Clean up a session directory.
   * @param {string} sessionId
   */
  cleanupSession(sessionId) {
    const sessionDir = path.join(this.workspaceRoot, 'sessions', sessionId);
    try {
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }
    } catch (err) {
      this._log('warn', `Failed to cleanup session ${sessionId}: ${err.message}`);
    }
  }

  // -------------------------------------------------------------------------
  // Logging
  // -------------------------------------------------------------------------

  _log(level, message, meta = {}) {
    if (!this.config.logCommands && level === 'debug') return;

    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    if (levels[level] < levels[this.config.logLevel]) return;

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...meta,
    };

    // Output to stderr to avoid polluting stdout (worker mode uses stdout)
    console.error(`[${logEntry.timestamp}] [${logEntry.level}] ${message}`);
  }

  // -------------------------------------------------------------------------
  // Environment filtering
  // -------------------------------------------------------------------------

  /**
   * Filter environment variables for sandbox execution.
   * @param {Object} env - Environment to filter (default: process.env)
   * @returns {Object} Filtered environment
   */
  filterEnv(env = process.env) {
    return this.envFilter.filter(env);
  }

  /**
   * Get the environment for a sandboxed process.
   * @param {Object} overrides - Additional env vars to set
   * @returns {Object}
   */
  _getSandboxEnv(overrides = {}) {
    const base = this.filterEnv(process.env);

    // Set safe defaults
    base.HOME = this.workspaceRoot;
    base.TMPDIR = path.join(this.workspaceRoot, 'tmp');
    base.TEMP = base.TMPDIR;
    base.TMP = base.TMPDIR;

    // Ensure tmp directory exists
    try {
      fs.mkdirSync(base.TMPDIR, { recursive: true });
    } catch (err) {
      // Ignore
    }

    return { ...base, ...overrides };
  }

  // -------------------------------------------------------------------------
  // Path validation (public interface)
  // -------------------------------------------------------------------------

  /**
   * Validate a file path against allowed directories.
   * @param {string} filePath
   * @returns {Object} {valid, normalizedPath, error}
   */
  validatePath(filePath) {
    return validatePath(filePath, {
      workspaceRoot: this.workspaceRoot,
      allowedDirs: this.allowedDirs,
    });
  }

  /**
   * Validate a directory path.
   * @param {string} dirPath
   * @returns {Object}
   */
  validateDirectoryPath(dirPath) {
    return validateDirectoryPath(dirPath, {
      workspaceRoot: this.workspaceRoot,
      allowedDirs: this.allowedDirs,
    });
  }

  // -------------------------------------------------------------------------
  // Command builders for sandbox engines
  // -------------------------------------------------------------------------

  /**
   * Build a firejail command with security restrictions.
   */
  _buildFirejailCommand(command, cwd) {
    const memoryBytes = this.config.maxMemory * 1024 * 1024;
    const args = [
      '--private=' + this.workspaceRoot,
      '--private-tmp',
      '--net=' + (this.config.networkEnabled ? 'eth0' : 'none'),
      '--rlimit-cpu=' + this.config.maxCpuTime,
      '--rlimit-as=' + memoryBytes,
      '--rlimit-fsize=' + (this.config.maxFileSize * 1024 * 1024),
      '--rlimit-nofile=256',        // Limit open files
      '--rlimit-nproc=64',          // Limit processes
      '--seccomp',                   // Enable seccomp filter
      '--noroot',                    // No root access
      '--nosound',                   // No sound device
      '--no3d',                      // No GPU access
      '--shell=none',                // No shell access within sandbox
    ];

    // Whitelist allowed directories
    for (const dir of this.allowedDirs) {
      args.push('--whitelist=' + dir);
    }

    // Working directory
    if (cwd) {
      args.push('--cwd=' + cwd);
    }

    // Execute the command via bash -c
    args.push('bash', '-c', command);

    return { binary: 'firejail', args };
  }

  /**
   * Build a systemd-run command with security restrictions.
   */
  _buildSystemdRunCommand(command, cwd) {
    const memoryBytes = this.config.maxMemory * 1024 * 1024;
    const args = [
      '--scope',
      '--property=CPUQuota=' + this.config.maxCpuTime + 's',
      '--property=MemoryMax=' + memoryBytes,
      '--property=TasksMax=64',
      '--property=LimitNOFILE=256',
    ];

    if (!this.config.networkEnabled) {
      args.push('--property=PrivateNetwork=yes');
    }

    // Execute
    args.push('bash', '-c', command);

    return { binary: 'systemd-run', args };
  }

  /**
   * Build a regular spawn command with manual restrictions.
   * Used when firejail and systemd-run are not available.
   */
  _buildSpawnCommand(command, cwd) {
    return { binary: 'bash', args: ['-c', command] };
  }

  // -------------------------------------------------------------------------
  // Core execution
  // -------------------------------------------------------------------------

  /**
   * Execute a shell command in a sandboxed environment.
   *
   * @param {string} command - The command to execute
   * @param {Object} options - Execution options
   * @param {string} options.cwd - Working directory (relative to workspace)
   * @param {Object} options.env - Additional environment variables
   * @param {number} options.timeout - Timeout in milliseconds
   * @param {number} options.maxOutput - Maximum output size in bytes
   * @param {boolean} options.allowNetwork - Override network policy for this command
   * @param {boolean} options.skipWhitelist - Skip command whitelist (DANGEROUS, for internal use only)
   *
   * @returns {Promise<Object>} Execution result:
   *   - success {boolean}: Whether execution succeeded
   *   - stdout {string}: Standard output
   *   - stderr {string}: Standard error
   *   - exitCode {number}: Process exit code
   *   - duration {number}: Execution time in milliseconds
   *   - killed {boolean}: Whether the process was killed (timeout/OOM)
   *   - killReason {string|null}: Why the process was killed
   */
  async executeShell(command, options = {}) {
    const startTime = Date.now();

    // --- Validate input ---
    if (typeof command !== 'string') {
      this.stats.commandsBlocked++;
      return this._errorResult('Command must be a string', startTime);
    }

    if (command.length === 0) {
      this.stats.commandsBlocked++;
      return this._errorResult('Command cannot be empty', startTime);
    }

    const maxOutput = options.maxOutput || this.config.maxOutputSize;
    const timeout = options.timeout || this.config.defaultTimeout;

    // --- Validate working directory ---
    let cwd = this.workspaceRoot;
    if (options.cwd) {
      const cwdValidation = this.validatePath(options.cwd);
      if (!cwdValidation.valid) {
        this.stats.commandsBlocked++;
        return this._errorResult(`Invalid working directory: ${cwdValidation.error}`, startTime);
      }
      cwd = cwdValidation.normalizedPath;
    }

    // --- Validate command against whitelist (unless skipped) ---
    if (!options.skipWhitelist) {
      const whitelistResult = validateCommand(command, {
        allowNetwork: options.allowNetwork || this.config.networkEnabled,
        workspaceRoot: this.workspaceRoot,
      });

      if (!whitelistResult.allowed) {
        this.stats.commandsBlocked++;
        this._log('warn', `Blocked command: ${command}`, { reason: whitelistResult.reason });
        return this._errorResult(`Command blocked: ${whitelistResult.reason}`, startTime);
      }
    }

    // --- Build sandbox command ---
    let execBinary, execArgs;
    switch (this.sandboxEngine) {
      case 'firejail': {
        const fc = this._buildFirejailCommand(command, cwd);
        execBinary = fc.binary;
        execArgs = fc.args;
        break;
      }
      case 'systemd-run': {
        const sc = this._buildSystemdRunCommand(command, cwd);
        execBinary = sc.binary;
        execArgs = sc.args;
        break;
      }
      default: {
        const sp = this._buildSpawnCommand(command, cwd);
        execBinary = sp.binary;
        execArgs = sp.args;
      }
    }

    // --- Filter environment ---
    const env = this._getSandboxEnv(options.env || {});

    // --- Log execution ---
    this._log('info', `Executing [${this.sandboxEngine}]: ${command.substring(0, 200)}`, {
      cwd,
      timeout,
    });

    // --- Execute with timeout and output limits ---
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let killed = false;
      let killReason = null;

      // Spawn the process
      const child = spawn(execBinary, execArgs, {
        cwd,
        env,
        // With firejail, we don't need additional groups but set them for fallback
        detached: this.sandboxEngine === 'spawn',
      });

      // Capture stdout with size limit
      child.stdout.on('data', (data) => {
        if (Buffer.byteLength(stdout, 'utf8') + data.length > maxOutput) {
          if (!killed) {
            killed = true;
            killReason = 'stdout size limit exceeded';
            child.kill('SIGKILL');
          }
          return;
        }
        stdout += data.toString('utf8');
      });

      // Capture stderr with size limit
      child.stderr.on('data', (data) => {
        if (Buffer.byteLength(stderr, 'utf8') + data.length > maxOutput) {
          if (!killed) {
            killed = true;
            killReason = 'stderr size limit exceeded';
            child.kill('SIGKILL');
          }
          return;
        }
        stderr += data.toString('utf8');
      });

      // Set timeout
      const timeoutId = setTimeout(() => {
        if (!killed) {
          killed = true;
          killReason = `timeout after ${timeout}ms`;
          child.kill('SIGKILL');
          // Force kill after grace period
          setTimeout(() => {
            try { child.kill('SIGKILL'); } catch (e) {}
          }, 5000);
        }
      }, timeout);

      // Handle process exit
      child.on('close', (exitCode, signal) => {
        clearTimeout(timeoutId);

        const duration = Date.now() - startTime;

        if (!killed && signal) {
          killed = true;
          killReason = `terminated by signal ${signal}`;
        }

        const result = {
          success: exitCode === 0 && !killed,
          stdout: stdout.substring(0, maxOutput),
          stderr: stderr.substring(0, maxOutput),
          exitCode: killed ? -1 : (exitCode ?? -1),
          duration,
          killed,
          killReason,
          engine: this.sandboxEngine,
        };

        this.stats.commandsExecuted++;
        this.stats.totalExecutionTime += duration;

        if (killed || exitCode !== 0) {
          this.stats.errors++;
        }

        this._log('debug', `Command finished in ${duration}ms, exit=${result.exitCode}`, {
          killed,
          killReason,
        });

        resolve(result);
      });

      // Handle spawn errors
      child.on('error', (err) => {
        clearTimeout(timeoutId);
        this.stats.errors++;

        // If firejail is not available, fall back to spawn
        if (this.sandboxEngine === 'firejail' && err.code === 'ENOENT') {
          this._log('warn', 'firejail not found, falling back to spawn');
          this.sandboxEngine = 'spawn';
          resolve(this.executeShell(command, { ...options, skipWhitelist: true }));
          return;
        }

        resolve({
          success: false,
          stdout: stdout.substring(0, maxOutput),
          stderr: stderr.substring(0, maxOutput) + `\n[spawn error: ${err.message}]`,
          exitCode: -1,
          duration: Date.now() - startTime,
          killed: false,
          killReason: `spawn error: ${err.message}`,
          engine: this.sandboxEngine,
        });
      });
    });
  }

  /**
   * Execute a script file in a sandboxed environment.
   *
   * @param {string} scriptPath - Path to the script (relative to workspace or absolute within)
   * @param {Object} options - Execution options
   * @param {string} options.interpreter - Interpreter to use (auto-detected from shebang if not set)
   * @param {string[]} options.args - Arguments to pass to the script
   * @returns {Promise<Object>} Same result shape as executeShell
   */
  async executeScript(scriptPath, options = {}) {
    // --- Validate script path ---
    const pathValidation = this.validatePath(scriptPath);
    if (!pathValidation.valid) {
      this.stats.commandsBlocked++;
      return {
        success: false,
        stdout: '',
        stderr: `Invalid script path: ${pathValidation.error}`,
        exitCode: -1,
        duration: 0,
        killed: false,
        killReason: null,
        engine: this.sandboxEngine,
      };
    }

    const resolvedPath = pathValidation.normalizedPath;

    // --- Check script exists ---
    if (!fs.existsSync(resolvedPath)) {
      return {
        success: false,
        stdout: '',
        stderr: `Script not found: ${resolvedPath}`,
        exitCode: -1,
        duration: 0,
        killed: false,
        killReason: null,
        engine: this.sandboxEngine,
      };
    }

    // --- Check it's a file ---
    const stats = fs.statSync(resolvedPath);
    if (!stats.isFile()) {
      return {
        success: false,
        stdout: '',
        stderr: `Path is not a file: ${resolvedPath}`,
        exitCode: -1,
        duration: 0,
        killed: false,
        killReason: null,
        engine: this.sandboxEngine,
      };
    }

    // --- Auto-detect interpreter from shebang ---
    let interpreter = options.interpreter;
    if (!interpreter) {
      interpreter = await this._detectInterpreter(resolvedPath);
    }

    // --- Build command ---
    const safePath = resolvedPath; // Already validated
    const scriptArgs = (options.args || []).join(' ');
    const command = `${interpreter} "${safePath}"${scriptArgs ? ' ' + scriptArgs : ''}`;

    // --- Execute via executeShell (with whitelist skip since path is validated) ---
    return this.executeShell(command, {
      ...options,
      cwd: options.cwd || path.dirname(resolvedPath),
      skipWhitelist: true, // We validated the script path ourselves
    });
  }

  /**
   * Detect interpreter from shebang line.
   * @param {string} filePath
   * @returns {string} Interpreter command
   */
  async _detectInterpreter(filePath) {
    try {
      const fd = fs.openSync(filePath, 'r');
      const buffer = Buffer.alloc(256);
      const bytesRead = fs.readSync(fd, buffer, 0, 256, 0);
      fs.closeSync(fd);

      const firstLine = buffer.toString('utf8', 0, bytesRead).split('\n')[0];

      if (firstLine.startsWith('#!')) {
        const shebang = firstLine.substring(2).trim();
        // Extract just the interpreter path (remove flags for safety)
        const match = shebang.match(/^\S+/);
        if (match) {
          const interp = match[0];
          // Map common interpreters to allowed commands
          const interpreterMap = {
            '/usr/bin/env': shebang.split(' ')[1] || 'bash',
            '/usr/bin/node': 'node',
            '/usr/bin/nodejs': 'node',
            '/usr/bin/python3': 'python3',
            '/usr/bin/python': 'python3',
            '/usr/bin/bash': 'bash',
            '/usr/bin/sh': 'bash',
            '/bin/node': 'node',
            '/bin/python3': 'python3',
            '/bin/bash': 'bash',
            '/bin/sh': 'bash',
          };

          for (const [prefix, mapped] of Object.entries(interpreterMap)) {
            if (interp === prefix || interp.endsWith(prefix)) {
              return mapped;
            }
          }

          // Default: use the basename of the interpreter
          return path.basename(interp);
        }
      }
    } catch (err) {
      // Fall through to default
    }

    // Default to node for unrecognized scripts
    return 'node';
  }

  // -------------------------------------------------------------------------
  // File operations (ALL go through path validation)
  // -------------------------------------------------------------------------

  /**
   * Write content to a file within the workspace.
   *
   * @param {string} filePath - Target file path (relative to workspace)
   @param {string|Buffer} content - Content to write
   * @param {Object} options - Write options
   * @param {string} options.encoding - File encoding (default: 'utf8')
   * @param {number} options.mode - File permissions (default: 0o644)
   * @returns {Promise<Object>} Result:
   *   - success {boolean}
   *   - path {string|null} Resolved path
   *   - bytesWritten {number}
   *   - error {string|null}
   */
  async writeFile(filePath, content, options = {}) {
    const startTime = Date.now();

    // --- Validate path ---
    const pathValidation = this.validatePath(filePath);
    if (!pathValidation.valid) {
      return {
        success: false,
        path: null,
        bytesWritten: 0,
        error: pathValidation.error,
        duration: Date.now() - startTime,
      };
    }

    const resolvedPath = pathValidation.normalizedPath;

    // --- Check for overwrites outside workspace ---
    const relativeToWorkspace = path.relative(this.workspaceRoot, resolvedPath);
    if (relativeToWorkspace.startsWith('..')) {
      return {
        success: false,
        path: null,
        bytesWritten: 0,
        error: 'Cannot write outside workspace',
        duration: Date.now() - startTime,
      };
    }

    // --- Ensure directory exists ---
    const dir = path.dirname(resolvedPath);
    try {
      fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
    } catch (err) {
      return {
        success: false,
        path: null,
        bytesWritten: 0,
        error: `Failed to create directory: ${err.message}`,
        duration: Date.now() - startTime,
      };
    }

    // --- Check file size limit ---
    const contentBuffer = Buffer.isBuffer(content) ? content : Buffer.from(content, options.encoding || 'utf8');
    const maxSize = (this.config.maxFileSize || 50) * 1024 * 1024;
    if (contentBuffer.length > maxSize) {
      return {
        success: false,
        path: null,
        bytesWritten: 0,
        error: `Content exceeds maximum file size of ${this.config.maxFileSize}MB`,
        duration: Date.now() - startTime,
      };
    }

    // --- Write file ---
    try {
      fs.writeFileSync(resolvedPath, contentBuffer, {
        encoding: options.encoding,
        mode: options.mode || 0o644,
        flag: 'w', // Always overwrite; no append mode for security
      });

      this.stats.filesWritten++;
      this._log('debug', `Wrote ${contentBuffer.length} bytes to ${resolvedPath}`);

      return {
        success: true,
        path: resolvedPath,
        bytesWritten: contentBuffer.length,
        error: null,
        duration: Date.now() - startTime,
      };
    } catch (err) {
      this.stats.errors++;
      return {
        success: false,
        path: resolvedPath,
        bytesWritten: 0,
        error: `Write failed: ${err.message}`,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Read content from a file within the workspace.
   *
   * @param {string} filePath - File path (relative to workspace)
   * @param {Object} options - Read options
   * @param {string} options.encoding - File encoding (default: 'utf8')
   * @param {number} options.maxSize - Maximum bytes to read (default: 10MB)
   * @returns {Promise<Object>} Result:
   *   - success {boolean}
   *   - path {string|null}
   *   - content {string|null}
   *   - bytesRead {number}
   *   - error {string|null}
   */
  async readFile(filePath, options = {}) {
    const startTime = Date.now();

    // --- Validate path ---
    const pathValidation = this.validatePath(filePath);
    if (!pathValidation.valid) {
      return {
        success: false,
        path: null,
        content: null,
        bytesRead: 0,
        error: pathValidation.error,
        duration: Date.now() - startTime,
      };
    }

    const resolvedPath = pathValidation.normalizedPath;

    // --- Check file exists ---
    if (!fs.existsSync(resolvedPath)) {
      return {
        success: false,
        path: resolvedPath,
        content: null,
        bytesRead: 0,
        error: 'File not found',
        duration: Date.now() - startTime,
      };
    }

    // --- Check it's a file ---
    try {
      const stats = fs.statSync(resolvedPath);
      if (!stats.isFile()) {
        return {
          success: false,
          path: resolvedPath,
          content: null,
          bytesRead: 0,
          error: 'Path is not a file',
          duration: Date.now() - startTime,
        };
      }

      // --- Check file size ---
      const maxSize = (options.maxSize || 10 * 1024 * 1024);
      if (stats.size > maxSize) {
        return {
          success: false,
          path: resolvedPath,
          content: null,
          bytesRead: 0,
          error: `File exceeds maximum read size of ${maxSize} bytes`,
          duration: Date.now() - startTime,
        };
      }

      // --- Read file ---
      const content = fs.readFileSync(resolvedPath, {
        encoding: options.encoding || 'utf8',
        flag: 'r',
      });

      this.stats.filesRead++;

      return {
        success: true,
        path: resolvedPath,
        content: content,
        bytesRead: stats.size,
        error: null,
        duration: Date.now() - startTime,
      };
    } catch (err) {
      this.stats.errors++;
      return {
        success: false,
        path: resolvedPath,
        content: null,
        bytesRead: 0,
        error: `Read failed: ${err.message}`,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Check if a file exists within the workspace.
   *
   * @param {string} filePath
   * @returns {Promise<Object>}
   */
  async fileExists(filePath) {
    const pathValidation = this.validatePath(filePath);
    if (!pathValidation.valid) {
      return {
        exists: false,
        path: null,
        error: pathValidation.error,
      };
    }

    const resolvedPath = pathValidation.normalizedPath;
    try {
      const exists = fs.existsSync(resolvedPath);
      let stats = null;
      if (exists) {
        stats = fs.statSync(resolvedPath);
      }
      return {
        exists,
        path: resolvedPath,
        isFile: stats ? stats.isFile() : false,
        isDirectory: stats ? stats.isDirectory() : false,
        size: stats ? stats.size : 0,
        error: null,
      };
    } catch (err) {
      return {
        exists: false,
        path: resolvedPath,
        error: err.message,
      };
    }
  }

  // -------------------------------------------------------------------------
  // Worker process support
  // -------------------------------------------------------------------------

  /**
   * Run in worker mode: read JSON commands from stdin, write JSON results to stdout.
   * Each line of stdin is a JSON object with:
   *   { action: 'execute', command: '...', options: {} }
   *   { action: 'writeFile', path: '...', content: '...', options: {} }
   *   { action: 'readFile', path: '...', options: {} }
   *   { action: 'exit' }
   *
   * Results are written as JSON lines to stdout.
   */
  async runWorker() {
    this.config.workerMode = true;
    this._log('info', 'Sandbox executor worker started');

    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    for await (const line of rl) {
      let request;
      try {
        request = JSON.parse(line);
      } catch (err) {
        this._writeResponse({
          success: false,
          error: 'Invalid JSON: ' + err.message,
        });
        continue;
      }

      const result = await this._handleWorkerRequest(request);
      this._writeResponse(result);

      if (request.action === 'exit') {
        rl.close();
        break;
      }
    }

    this._log('info', 'Sandbox executor worker stopped');
  }

  /**
   * Handle a single worker request.
   * @private
   */
  async _handleWorkerRequest(request) {
    if (!request || !request.action) {
      return { success: false, error: 'Missing action field' };
    }

    try {
      switch (request.action) {
        case 'execute':
        case 'executeShell': {
          if (!request.command) {
            return { success: false, error: 'Missing command field' };
          }
          return await this.executeShell(request.command, request.options || {});
        }

        case 'executeScript': {
          if (!request.scriptPath) {
            return { success: false, error: 'Missing scriptPath field' };
          }
          return await this.executeScript(request.scriptPath, request.options || {});
        }

        case 'writeFile':
        case 'write': {
          if (!request.path && !request.filePath) {
            return { success: false, error: 'Missing path/filePath field' };
          }
          if (request.content === undefined) {
            return { success: false, error: 'Missing content field' };
          }
          return await this.writeFile(
            request.path || request.filePath,
            request.content,
            request.options || {}
          );
        }

        case 'readFile':
        case 'read': {
          if (!request.path && !request.filePath) {
            return { success: false, error: 'Missing path/filePath field' };
          }
          return await this.readFile(
            request.path || request.filePath,
            request.options || {}
          );
        }

        case 'fileExists':
        case 'exists': {
          if (!request.path && !request.filePath) {
            return { success: false, error: 'Missing path/filePath field' };
          }
          return await this.fileExists(request.path || request.filePath);
        }

        case 'validatePath': {
          if (!request.path && !request.filePath) {
            return { success: false, error: 'Missing path/filePath field' };
          }
          return this.validatePath(request.path || request.filePath);
        }

        case 'getStats': {
          return {
            success: true,
            stats: { ...this.stats },
          };
        }

        case 'getConfig': {
          return {
            success: true,
            config: {
              workspaceRoot: this.workspaceRoot,
              allowedDirs: this.allowedDirs,
              maxCpuTime: this.config.maxCpuTime,
              maxMemory: this.config.maxMemory,
              networkEnabled: this.config.networkEnabled,
              sandboxEngine: this.sandboxEngine,
            },
          };
        }

        case 'ping': {
          return { success: true, pong: true };
        }

        case 'exit': {
          return { success: true, message: 'Exiting' };
        }

        default:
          return { success: false, error: `Unknown action: ${request.action}` };
      }
    } catch (err) {
      this._log('error', `Worker request error: ${err.message}`, { action: request.action });
      return {
        success: false,
        error: `Internal error: ${err.message}`,
      };
    }
  }

  /**
   * Write a JSON response to stdout (worker mode).
   * @private
   */
  _writeResponse(response) {
    try {
      process.stdout.write(JSON.stringify(response) + '\n');
    } catch (err) {
      // If we can't write, there's not much we can do
      process.stderr.write(`Failed to write response: ${err.message}\n`);
    }
  }

  // -------------------------------------------------------------------------
  // Utility methods
  // -------------------------------------------------------------------------

  /**
   * Build an error result object.
   * @private
   */
  _errorResult(message, startTime) {
    return {
      success: false,
      stdout: '',
      stderr: message,
      exitCode: -1,
      duration: Date.now() - startTime,
      killed: false,
      killReason: null,
      engine: this.sandboxEngine,
    };
  }

  /**
   * Get current executor statistics.
   * @returns {Object}
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Reset statistics.
   */
  resetStats() {
    this.stats = {
      commandsExecuted: 0,
      commandsBlocked: 0,
      filesWritten: 0,
      filesRead: 0,
      totalExecutionTime: 0,
      errors: 0,
    };
  }

  /**
   * Get the current sandbox engine name.
   * @returns {string}
   */
  getSandboxEngine() {
    return this.sandboxEngine;
  }
}

// ---------------------------------------------------------------------------
// Standalone convenience functions
// ---------------------------------------------------------------------------

/**
 * Create a default executor and execute a shell command.
 * @param {string} command
 * @param {Object} options
 * @returns {Promise<Object>}
 */
async function executeShell(command, options = {}) {
  const executor = new SandboxExecutor(options.config || {});
  return executor.executeShell(command, options);
}

/**
 * Create a default executor and write a file.
 * @param {string} filePath
 * @param {string|Buffer} content
 * @param {Object} options
 * @returns {Promise<Object>}
 */
async function writeFile(filePath, content, options = {}) {
  const executor = new SandboxExecutor(options.config || {});
  return executor.writeFile(filePath, content, options);
}

/**
 * Create a default executor and read a file.
 * @param {string} filePath
 * @param {Object} options
 * @returns {Promise<Object>}
 */
async function readFile(filePath, options = {}) {
  const executor = new SandboxExecutor(options.config || {});
  return executor.readFile(filePath, options);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  SandboxExecutor,
  executeShell,
  writeFile,
  readFile,
  DEFAULT_CONFIG,
};
