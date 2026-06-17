/**
 * Environment Variable Filter - NEXO Landing Page Creator v3.0
 *
 * Filters environment variables before passing them to sandboxed processes.
 * Removes sensitive secrets and tokens while preserving safe operational variables.
 *
 * SECURITY MODEL:
 * - Default-deny for unknown sensitive patterns
 * - Explicit allow-list for safe variables
 * - Configurable per-instance customization
 * - Deep inspection of values for embedded secrets
 */

'use strict';

/**
 * Default list of environment variable names that contain sensitive data.
 * These will be removed (set to undefined) from the filtered environment.
 */
const DEFAULT_SENSITIVE_VARS = [
  // Authentication & Tokens
  'JWT_SECRET',
  'JWT_PRIVATE_KEY',
  'JWT_PUBLIC_KEY',
  'INTERNAL_API_TOKEN',
  'INTERNAL_API_KEY',
  'API_SECRET',
  'API_KEY_SECRET',
  'AUTH_SECRET',
  'AUTH_TOKEN',
  'BEARER_TOKEN',
  'ACCESS_TOKEN',
  'REFRESH_TOKEN',
  'SESSION_SECRET',
  'SESSION_KEY',
  'CSRF_SECRET',
  'COOKIE_SECRET',

  // Database credentials
  'DATABASE_URL',
  'DB_PASSWORD',
  'DB_HOST',
  'DB_USER',
  'DB_NAME',
  'POSTGRES_PASSWORD',
  'MYSQL_PASSWORD',
  'MONGODB_URI',
  'REDIS_PASSWORD',
  'REDIS_URL',
  'ELASTICSEARCH_PASSWORD',

  // GitHub / Git / VCS
  'GITHUB_TOKEN',
  'GITHUB_CLIENT_SECRET',
  'GITHUB_APP_PRIVATE_KEY',
  'GIT_TOKEN',
  'GITLAB_TOKEN',
  'BITBUCKET_TOKEN',

  // SSH / Keys
  'PRIVATE_KEY',
  'SSH_PRIVATE_KEY',
  'SSH_KEY',
  'RSA_PRIVATE_KEY',
  'EC_PRIVATE_KEY',
  'ED25519_PRIVATE_KEY',
  'SSL_CERTIFICATE',
  'SSL_PRIVATE_KEY',
  'TLS_CERT',
  'TLS_KEY',
  'CA_CERTIFICATE',

  // Cloud Provider
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_SESSION_TOKEN',
  'AZURE_CLIENT_SECRET',
  'AZURE_STORAGE_KEY',
  'GCP_SERVICE_ACCOUNT_KEY',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'GOOGLE_API_KEY',
  'ALICLOUD_ACCESS_KEY',
  'ALICLOUD_SECRET_KEY',

  // Generic secrets
  'SECRET_KEY',
  'SECRET',
  'MASTER_KEY',
  'ENCRYPTION_KEY',
  'CRYPTO_KEY',
  'PASSWORD',
  'ROOT_PASSWORD',
  'ADMIN_PASSWORD',
  'USER_PASSWORD',
  'PASSPHRASE',
  'CREDENTIALS',
  'OAUTH_CLIENT_SECRET',
  'OAUTH_TOKEN',
  'WEBHOOK_SECRET',
  'SIGNING_SECRET',
  'HMAC_SECRET',
  'SHARED_SECRET',
  'VAULT_TOKEN',
  'NPM_TOKEN',
  'NPM_AUTH_TOKEN',
  'DOCKER_AUTH_CONFIG',
  'KUBECONFIG',
  'SENTRY_DSN',  // Contains embedded credentials

  // Nexo-specific
  'NEXO_API_SECRET',
  'NEXO_INTERNAL_KEY',
  'NEXO_ADMIN_TOKEN',
];

/**
 * Default list of safe environment variables to preserve.
 * These are necessary for basic tool operation.
 */
const DEFAULT_SAFE_VARS = [
  // PATH and shell basics
  'PATH',
  'HOME',
  'USER',
  'SHELL',
  'TMPDIR',
  'TEMP',
  'TMP',

  // Node.js
  'NODE_ENV',
  'NODE_PATH',
  'NODE_OPTIONS',

  // Locale and timezone
  'LANG',
  'LC_ALL',
  'LC_COLLATE',
  'LC_CTYPE',
  'LC_MESSAGES',
  'LC_MONETARY',
  'LC_NUMERIC',
  'LC_TIME',
  'TZ',

  // Terminal
  'TERM',
  'TERM_PROGRAM',
  'COLORTERM',

  // System
  'HOSTNAME',
  'PWD',
  'OLDPWD',
  'SHLVL',

  // Git (safe config only)
  'GIT_CONFIG_GLOBAL',
  'GIT_CONFIG_SYSTEM',

  // Build tools
  'npm_config_user_agent',
  'npm_execpath',
  'npm_node_execpath',
  'npm_lifecycle_event',
  'npm_package_name',
];

/**
 * Patterns that indicate a value contains a secret/token.
 * Used for deep inspection of values even if the key looks safe.
 */
const SENSITIVE_VALUE_PATTERNS = [
  // JWT tokens (three base64 parts separated by dots)
  /^eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*$/,
  // API keys: long hex strings
  /^[a-f0-9]{32,}$/i,
  // API keys: base64-like long strings with special endings
  /^[A-Za-z0-9+/]{40,}={0,2}$/,
  // Private key markers
  /^-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
  // Passwords in URLs (user:pass@host)
  /:\/\/[^\/\s:]+:[^\/\s@]+@/,
  // AWS key patterns
  /AKIA[0-9A-Z]{16}/,
  // GitHub classic token
  /ghp_[a-zA-Z0-9]{36}/,
  // GitHub fine-grained token
  /github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}/,
  // Generic bearer token
  /Bearer\s+[a-zA-Z0-9_\-\.]+/,
];

/**
 * Environment filter class for configurable filtering.
 */
class EnvFilter {
  /**
   * @param {Object} config - Configuration options
   * @param {string[]} config.denyList - Additional variable names to remove
   * @param {string[]} config.allowList - Additional safe variable names to preserve
   * @param {boolean} config.strictMode - If true, only allow explicitly safe vars (default: false)
   * @param {boolean} config.inspectValues - If true, scan values for embedded secrets (default: true)
   * @param {string[]} config.sensitivePatterns - Additional regex patterns for value inspection
   */
  constructor(config = {}) {
    this.strictMode = config.strictMode || false;
    this.inspectValues = config.inspectValues !== false; // default true

    // Build the deny set (case-insensitive lookup)
    this.denySet = new Set([
      ...DEFAULT_SENSITIVE_VARS.map(v => v.toLowerCase()),
      ...(config.denyList || []).map(v => v.toLowerCase())
    ]);

    // Build the allow set
    this.allowSet = new Set([
      ...DEFAULT_SAFE_VARS.map(v => v.toLowerCase()),
      ...(config.allowList || []).map(v => v.toLowerCase())
    ]);

    // Additional patterns for value inspection
    this.valuePatterns = [
      ...SENSITIVE_VALUE_PATTERNS,
      ...(config.sensitivePatterns || [])
    ];

    // Stats for monitoring (optional)
    this.stats = {
      totalFiltered: 0,
      deniedByName: 0,
      deniedByValue: 0,
      allowed: 0,
    };
  }

  /**
   * Check if a variable name is in the deny list.
   * @param {string} varName
   * @returns {boolean}
   */
  isDenied(varName) {
    return this.denySet.has(varName.toLowerCase());
  }

  /**
   * Check if a variable name is in the allow list.
   * @param {string} varName
   * @returns {boolean}
   */
  isAllowed(varName) {
    return this.allowSet.has(varName.toLowerCase());
  }

  /**
   * Inspect a value for patterns that indicate it contains a secret.
   * @param {string} value
   * @returns {boolean} true if the value looks sensitive
   */
  valueLooksSensitive(value) {
    if (typeof value !== 'string') return false;
    if (value.length === 0) return false;

    for (const pattern of this.valuePatterns) {
      if (pattern.test(value)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Filter an environment object.
   * @param {Object} env - The environment to filter (default: process.env)
   * @returns {Object} Filtered environment with sensitive vars removed
   */
  filter(env = process.env) {
    const filtered = {};
    this.stats.totalFiltered = 0;
    this.stats.deniedByName = 0;
    this.stats.deniedByValue = 0;
    this.stats.allowed = 0;

    for (const [key, value] of Object.entries(env)) {
      // Check deny list first
      if (this.isDenied(key)) {
        this.stats.deniedByName++;
        continue; // Skip this variable entirely
      }

      // In strict mode, only allow explicitly safe vars
      if (this.strictMode && !this.isAllowed(key)) {
        this.stats.deniedByName++;
        continue;
      }

      // Value inspection for embedded secrets
      if (this.inspectValues && this.valueLooksSensitive(String(value))) {
        // In strict mode, remove it. In normal mode, replace with empty string.
        if (this.strictMode) {
          this.stats.deniedByValue++;
          continue;
        }
        // Replace with empty to preserve the key but remove the secret
        filtered[key] = '';
        this.stats.deniedByValue++;
        continue;
      }

      // Variable is safe
      filtered[key] = value;
      this.stats.allowed++;
    }

    this.stats.totalFiltered = Object.keys(env).length;
    return filtered;
  }

  /**
   * Get the list of variables that would be removed (for logging/debugging).
   * @param {Object} env
   * @returns {string[]} List of variable names that would be filtered out
   */
  getRemovedVars(env = process.env) {
    const removed = [];
    for (const key of Object.keys(env)) {
      if (this.isDenied(key)) {
        removed.push(key);
        continue;
      }
      if (this.strictMode && !this.isAllowed(key)) {
        removed.push(key);
        continue;
      }
      if (this.inspectValues && this.valueLooksSensitive(String(env[key]))) {
        removed.push(key);
      }
    }
    return removed;
  }

  /**
   * Reset statistics counters.
   */
  resetStats() {
    this.stats = {
      totalFiltered: 0,
      deniedByName: 0,
      deniedByValue: 0,
      allowed: 0,
    };
  }
}

/**
 * Simple function interface for quick filtering without creating a class instance.
 * @param {Object} env - Environment to filter
 * @param {Object} options - Options to pass to EnvFilter constructor
 * @returns {Object} Filtered environment
 */
function filterEnv(env, options) {
  const filter = new EnvFilter(options);
  return filter.filter(env);
}

/**
 * Check if a specific environment variable name is considered sensitive.
 * @param {string} varName
 * @returns {boolean}
 */
function isSensitiveVar(varName) {
  const denySet = new Set(DEFAULT_SENSITIVE_VARS.map(v => v.toLowerCase()));
  return denySet.has(varName.toLowerCase());
}

/**
 * Create a minimal safe environment with only essential variables.
 * Useful for creating a clean sandbox environment.
 * @param {Object} overrides - Variables to add on top of the minimal set
 * @returns {Object}
 */
function createMinimalEnv(overrides = {}) {
  const minimal = {};

  // Essential PATH
  minimal.PATH = process.env.PATH || '/usr/local/bin:/usr/bin:/bin';

  // Home directory
  minimal.HOME = process.env.HOME || '/tmp';

  // Locale
  minimal.LANG = process.env.LANG || 'en_US.UTF-8';

  // Node environment
  minimal.NODE_ENV = process.env.NODE_ENV || 'production';

  // Timezone
  minimal.TZ = process.env.TZ || 'UTC';

  // Temporary directory
  minimal.TMPDIR = '/tmp';
  minimal.TEMP = '/tmp';
  minimal.TMP = '/tmp';

  // Apply overrides (caller is responsible for safety)
  return { ...minimal, ...overrides };
}

module.exports = {
  EnvFilter,
  filterEnv,
  isSensitiveVar,
  createMinimalEnv,
  // Export defaults for customization
  DEFAULT_SENSITIVE_VARS,
  DEFAULT_SAFE_VARS,
  SENSITIVE_VALUE_PATTERNS,
};
