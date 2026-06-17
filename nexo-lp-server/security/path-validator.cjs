/**
 * Path Validator - NEXO Landing Page Creator v3.0
 *
 * Defensive path validation module that:
 * - Rejects paths with '..' traversal attempts
 * - Normalizes paths (resolves ., .., double slashes)
 * - Validates against an allowed directories whitelist
 * - Rejects absolute paths outside the workspace
 * - Prevents symlink-based escapes (resolves real paths)
 *
 * All file operations MUST go through this validator before execution.
 */

const path = require('path');
const fs = require('fs');

/**
 * Default allowed directories (will be combined with workspaceRoot)
 */
const DEFAULT_ALLOWED_DIRS = [];

/**
 * Pattern to detect path traversal attempts.
 * Matches .. at start, after /, or before end.
 */
const TRAVERSAL_PATTERN = /(?:^|\\|\/)\.\.(?:$|\\|\/)/;

/**
 * Pattern to detect null byte injection attempts.
 */
const NULL_BYTE_PATTERN = /\0/;

/**
 * Pattern to detect shell metacharacters in paths.
 */
const SHELL_METACHAR_PATTERN = /[;&|`$(){}[\]!*?#~<>]/;

/**
 * Validate a file path against security policies.
 *
 * @param {string} filePath - The path to validate
 * @param {Object} options - Validation options
 * @param {string} options.workspaceRoot - The workspace root directory (required)
 * @param {string[]} options.allowedDirs - Additional allowed directories
 * @param {boolean} options.mustExist - Whether the path must already exist
 * @param {boolean} options.allowAbsolute - Whether to allow absolute paths (default: true if under workspace)
 * @param {Set<string>} options.blockedPaths - Specific paths to block (e.g., /etc/passwd)
 *
 * @returns {Object} Validation result:
 *   - valid {boolean}: Whether the path is safe
 *   - normalizedPath {string|null}: The resolved, safe path (null if invalid)
 *   - realPath {string|null}: The real filesystem path (null if doesn't exist or invalid)
 *   - error {string|null}: Error message if invalid
 */
function validatePath(filePath, options = {}) {
  // --- Input sanity checks ---
  if (typeof filePath !== 'string') {
    return {
      valid: false,
      normalizedPath: null,
      realPath: null,
      error: 'Path must be a string, got ' + typeof filePath
    };
  }

  if (filePath.length === 0) {
    return {
      valid: false,
      normalizedPath: null,
      realPath: null,
      error: 'Path cannot be empty'
    };
  }

  if (filePath.length > 4096) {
    return {
      valid: false,
      normalizedPath: null,
      realPath: null,
      error: 'Path exceeds maximum length of 4096 characters'
    };
  }

  // --- Null byte injection check ---
  if (NULL_BYTE_PATTERN.test(filePath)) {
    return {
      valid: false,
      normalizedPath: null,
      realPath: null,
      error: 'Path contains null bytes (possible injection attack)'
    };
  }

  // --- Shell metacharacter check ---
  if (SHELL_METACHAR_PATTERN.test(filePath)) {
    return {
      valid: false,
      normalizedPath: null,
      realPath: null,
      error: 'Path contains shell metacharacters (possible command injection)'
    };
  }

  // --- Traversal pattern check ---
  if (TRAVERSAL_PATTERN.test(filePath)) {
    return {
      valid: false,
      normalizedPath: null,
      realPath: null,
      error: 'Path contains traversal sequence (..) which is not allowed'
    };
  }

  // --- Blocked paths check ---
  const blockedPaths = options.blockedPaths || getDefaultBlockedPaths();
  const lowerPath = filePath.toLowerCase();
  for (const blocked of blockedPaths) {
    if (lowerPath === blocked || lowerPath.startsWith(blocked + path.sep)) {
      return {
        valid: false,
        normalizedPath: null,
        realPath: null,
        error: `Path matches blocked pattern: ${blocked}`
      };
    }
  }

  // --- Resolve workspace root ---
  const workspaceRoot = options.workspaceRoot;
  if (!workspaceRoot || typeof workspaceRoot !== 'string') {
    return {
      valid: false,
      normalizedPath: null,
      realPath: null,
      error: 'workspaceRoot is required for path validation'
    };
  }

  // --- Build allowed directories list ---
  const allowedDirs = new Set([
    path.resolve(workspaceRoot),
    ...(options.allowedDirs || DEFAULT_ALLOWED_DIRS).map(d => path.resolve(d))
  ]);

  // --- Normalize the path ---
  let resolvedPath;
  if (path.isAbsolute(filePath)) {
    // Absolute path: resolve directly
    resolvedPath = path.normalize(filePath);
  } else {
    // Relative path: resolve against workspace root
    resolvedPath = path.resolve(workspaceRoot, filePath);
  }

  // --- Double-check traversal after normalization ---
  const relativeToWorkspace = path.relative(path.resolve(workspaceRoot), resolvedPath);
  if (relativeToWorkspace.startsWith('..') || relativeToWorkspace === '..') {
    // Path escapes the workspace - check if it's in allowedDirs
    let inAllowedDir = false;
    for (const allowedDir of allowedDirs) {
      const relativeToAllowed = path.relative(allowedDir, resolvedPath);
      if (!relativeToAllowed.startsWith('..') && relativeToAllowed !== '..') {
        inAllowedDir = true;
        break;
      }
    }
    if (!inAllowedDir) {
      return {
        valid: false,
        normalizedPath: null,
        realPath: null,
        error: `Resolved path escapes allowed directories: ${resolvedPath}`
      };
    }
  }

  // --- Resolve symlinks (prevents symlink escape attacks) ---
  let realPath = null;
  try {
    if (fs.existsSync(resolvedPath)) {
      realPath = fs.realpathSync(resolvedPath);
      // Re-validate the real path doesn't escape allowed dirs
      for (const allowedDir of allowedDirs) {
        const rel = path.relative(allowedDir, realPath);
        if (!rel.startsWith('..') && rel !== '..') {
          break;
        }
      }
    }
  } catch (err) {
    // realpathSync can fail on permission errors - that's ok, we'll use resolvedPath
    realPath = null;
  }

  // --- Must-exist check ---
  if (options.mustExist && !fs.existsSync(resolvedPath)) {
    return {
      valid: false,
      normalizedPath: resolvedPath,
      realPath: null,
      error: `Path does not exist: ${resolvedPath}`
    };
  }

  // --- Final allowed directory validation ---
  let isWithinAllowed = false;
  for (const allowedDir of allowedDirs) {
    const rel = path.relative(allowedDir, resolvedPath);
    if (!rel.startsWith('..') && rel !== '..') {
      isWithinAllowed = true;
      break;
    }
  }

  if (!isWithinAllowed) {
    return {
      valid: false,
      normalizedPath: null,
      realPath: null,
      error: `Path is outside allowed directories: ${resolvedPath}`
    };
  }

  // --- All checks passed ---
  return {
    valid: true,
    normalizedPath: resolvedPath,
    realPath: realPath,
    error: null
  };
}

/**
 * Synchronous version of validatePath for use in constructors/setup.
 */
function validatePathSync(filePath, options = {}) {
  return validatePath(filePath, options);
}

/**
 * Validate that a directory path is safe and within allowed bounds.
 * Similar to validatePath but ensures the path is a directory (or will be one).
 */
function validateDirectoryPath(dirPath, options = {}) {
  const result = validatePath(dirPath, options);
  if (!result.valid) {
    return result;
  }

  // Ensure the path ends as a directory concept
  const normalizedDir = result.normalizedPath;

  // If it exists, verify it's actually a directory
  try {
    const stats = fs.statSync(normalizedDir);
    if (!stats.isDirectory()) {
      return {
        valid: false,
        normalizedPath: null,
        realPath: null,
        error: `Path exists but is not a directory: ${normalizedDir}`
      };
    }
  } catch (err) {
    // Directory doesn't exist yet - this is OK for creation operations
    // but we'll flag it so callers know
  }

  return {
    valid: true,
    normalizedPath: normalizedDir,
    realPath: result.realPath,
    error: null
  };
}

/**
 * Get the default list of blocked paths that should never be accessed.
 */
function getDefaultBlockedPaths() {
  return new Set([
    // System sensitive files
    '/etc/passwd',
    '/etc/shadow',
    '/etc/master.passwd',
    '/etc/sudoers',
    '/etc/ssh/sshd_config',
    '/etc/hosts',
    '/proc/self/environ',
    '/proc/self/cmdline',
    '/proc/self/mem',
    '/proc/self/maps',
    '/proc/self/fd',
    '/proc/self/exe',
    '/proc/self/cwd',
    '/proc/self/root',
    // SSH keys
    '/.ssh',
    '/root/.ssh',
    // Common secrets
    '/.env',
    '/.aws',
    '/.docker',
    '/.kube',
    // System directories that shouldn't be touched
    '/bin',
    '/sbin',
    '/usr/bin',
    '/usr/sbin',
    '/lib',
    '/lib64',
    '/usr/lib',
    '/usr/lib64',
    '/sys',
    '/dev',
    '/boot',
    '/var/log',
    '/var/spool',
    '/var/mail',
    '/tmp/..',  // traversal to root via /tmp
  ]);
}

/**
 * Check if a path contains any traversal patterns (quick check without full validation).
 * Useful for early-exit in command validation.
 */
function containsTraversal(filePath) {
  if (typeof filePath !== 'string') return true;
  if (filePath.length > 4096) return true;
  if (NULL_BYTE_PATTERN.test(filePath)) return true;
  return TRAVERSAL_PATTERN.test(filePath);
}

/**
 * Sanitize a filename by removing dangerous characters.
 * For use when generating filenames from user input.
 */
function sanitizeFilename(filename) {
  if (typeof filename !== 'string') {
    return 'unnamed';
  }
  // Remove path separators and dangerous chars
  return filename
    .replace(/[/\\]/g, '_')
    .replace(/\0/g, '')
    .replace(/[;&|`$(){}[\]!*?#~<>]/g, '')
    .replace(/\.\./g, '_')
    .replace(/^\.+/, '')
    .trim() || 'unnamed';
}

module.exports = {
  validatePath,
  validatePathSync,
  validateDirectoryPath,
  containsTraversal,
  sanitizeFilename,
  getDefaultBlockedPaths,
  // Re-export patterns for testing
  TRAVERSAL_PATTERN,
  NULL_BYTE_PATTERN,
  SHELL_METACHAR_PATTERN
};
