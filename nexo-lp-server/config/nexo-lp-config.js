/**
 * NEXO Landing Page Creator v3.0 - Centralized Configuration
 *
 * Loads configuration from environment variables with sensible defaults.
 * All configuration values are centralized here for easy management.
 *
 * @module config/nexo-lp-config
 * @version 3.0.0
 */

const path = require('path');

// Load environment variables if not already loaded
if (!process.env.DOTENV_LOADED) {
  require('dotenv').config();
  process.env.DOTENV_LOADED = 'true';
}

/**
 * Helper to get environment variable with default fallback
 * @param {string} key - Environment variable name
 * @param {any} defaultValue - Default value if not set
 * @returns {any} The config value
 */
const env = (key, defaultValue) => {
  const value = process.env[key];
  if (value === undefined || value === '') {
    return defaultValue;
  }

  // Handle boolean strings
  if (value === 'true') return true;
  if (value === 'false') return false;

  // Handle number strings
  if (!isNaN(value) && value.trim() !== '') {
    const num = Number(value);
    if (!isNaN(num)) return num;
  }

  return value;
};

/**
 * Parse comma-separated string into array
 * @param {string} key - Environment variable name
 * @param {string[]} defaultValue - Default array
 * @returns {string[]} Parsed array
 */
const envArray = (key, defaultValue) => {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.split(',').map((s) => s.trim()).filter(Boolean);
};

// Base path for data storage
const DATA_PATH = path.resolve(__dirname, '../../data');
const LOGS_PATH = path.resolve(__dirname, '../../logs');

const config = {
  // ============================================================
  // Server Configuration
  // ============================================================
  port: env('PORT', 3460),
  nodeEnv: env('NODE_ENV', 'development'),
  apiPrefix: env('API_PREFIX', '/api/nexo-lp'),

  // ============================================================
  // CORS Configuration
  // ============================================================
  corsOrigins: envArray('CORS_ORIGINS', ['http://localhost:3000', 'http://localhost:5174', 'http://localhost:8080']),

  // ============================================================
  // Database Configuration
  // ============================================================
  database: {
    path: env('DATABASE_PATH', path.join(DATA_PATH, 'nexo-lp.db')),
    verbose: env('DB_VERBOSE', false),
    migrationsPath: path.join(__dirname, '../models/migrations'),
  },

  // ============================================================
  // AI Bridge Configuration (Luna Kimi Bridge)
  // ============================================================
  kimiBridge: {
    // Luna Kimi Bridge uses Playwright CDP, not a REST API.
    // Set KIMI_BRIDGE_ENABLED=false to use the local mock generator.
    enabled: env('KIMI_BRIDGE_ENABLED', true),
    cdpUrl: env('KIMI_CDP_URL', 'http://127.0.0.1:9222'),
    maxPages: env('KIMI_MAX_PAGES', 5),
    timeout: env('KIMI_TIMEOUT', 120000),
    idleTimeout: env('KIMI_IDLE_TIMEOUT', 600000),
    cooldownMs: env('KIMI_COOLDOWN_MS', 5000),
    maxTypeLength: env('KIMI_MAX_TYPE_LENGTH', 500),
    mode: env('KIMI_MODE', 'thinking'), // instant | thinking | agent | swarm
    autoStartChrome: env('KIMI_AUTO_START_CHROME', true),
  },

  // ============================================================
  // Currency System Configuration (Estrelas, Sóis, Lunas)
  // ============================================================
  currencies: {
    defaultBalance: {
      stars: env('DEFAULT_CURRENCY_STARS', 50),
      suns: env('DEFAULT_CURRENCY_SUNS', 5),
      moons: env('DEFAULT_CURRENCY_MOONS', 1),
    },
    costs: {
      generate: {
        stars: env('COST_GENERATE_STARS', 2),
        suns: env('COST_GENERATE_SUNS', 1),
        moons: env('COST_GENERATE_MOONS', 1),
      },
      rebuild: {
        stars: env('COST_REBUILD_STARS', 1),
        suns: env('COST_REBUILD_SUNS', 1),
        moons: env('COST_REBUILD_MOONS', 0),
      },
      publish: {
        stars: env('COST_PUBLISH_STARS', 1),
        suns: env('COST_PUBLISH_SUNS', 0),
        moons: env('COST_PUBLISH_MOONS', 0),
      },
    },
    exchange: {
      sunsToStars: env('EXCHANGE_SUNS_TO_STARS', 10),
      moonsToSuns: env('EXCHANGE_MOONS_TO_SUNS', 5),
    },
  },

  // Legacy token config kept for backwards compatibility
  tokens: {
    defaultBalance: env('DEFAULT_TOKEN_BALANCE', 50),
    costGenerate: env('TOKEN_COST_GENERATE', 10),
    costDeploy: env('TOKEN_COST_DEPLOY', 5),
    costRebuild: env('TOKEN_COST_REBUILD', 3),
    costMining: env('TOKEN_COST_MINING', 2),
    costTemplate: env('TOKEN_COST_TEMPLATE', 1),
  },

  // ============================================================
  // GitHub Pages Deployment Configuration
  // ============================================================
  github: {
    token: env('GITHUB_TOKEN', ''),
    owner: env('GITHUB_OWNER', ''),
    repo: env('GITHUB_REPO', ''),
    branch: env('GITHUB_PAGES_BRANCH', 'gh-pages'),
    baseUrl: env('GITHUB_PAGES_BASE_URL', ''),
  },

  // ============================================================
  // Preview Configuration
  // ============================================================
  preview: {
    baseUrl: env('PREVIEW_BASE_URL', `http://localhost:${env('PORT', 3460)}`),
    storagePath: env('PREVIEW_STORAGE_PATH', path.join(DATA_PATH, 'previews')),
    ttlMs: env('PREVIEW_TTL_MS', 24 * 60 * 60 * 1000), // 24 hours
    maxSizeBytes: env('PREVIEW_MAX_SIZE_BYTES', 5 * 1024 * 1024), // 5MB
  },

  // ============================================================
  // Mining Pipeline Configuration
  // ============================================================
  mining: {
    enabled: env('MINING_ENABLED', true),
    queueSize: env('MINING_QUEUE_SIZE', 10),
    outputPath: env('MINING_OUTPUT_PATH', path.join(DATA_PATH, 'mined-templates')),
    requestTimeout: env('MINING_REQUEST_TIMEOUT', 30000),
    maxConcurrent: env('MINING_MAX_CONCURRENT', 3),
    userAgent: env('MINING_USER_AGENT', 'NEXO-LP-Creator/3.0'),
  },

  // ============================================================
  // Bug Detection Configuration
  // ============================================================
  bugDetection: {
    enabled: env('BUG_DETECTION_ENABLED', true),
    maxIssues: env('BUG_DETECTION_MAX_ISSUES', 50),
    minSeverity: env('BUG_DETECTION_MIN_SEVERITY', 'warning'),
    htmlValidator: env('BUG_DETECTION_HTML_VALIDATOR', true),
    cssValidator: env('BUG_DETECTION_CSS_VALIDATOR', true),
    accessibilityValidator: env('BUG_DETECTION_A11Y_VALIDATOR', true),
    seoValidator: env('BUG_DETECTION_SEO_VALIDATOR', true),
  },

  // ============================================================
  // Rebuild Engine Configuration
  // ============================================================
  rebuild: {
    maxAttempts: env('REBUILD_MAX_ATTEMPTS', 3),
    autoFixEnabled: env('REBUILD_AUTO_FIX_ENABLED', true),
    fixStrategies: [
      'auto_fix',
      'simplify_markup',
      'regenerate_section',
    ],
  },

  // ============================================================
  // LOJA (Template Marketplace) Configuration
  // ============================================================
  loja: {
    defaultPrices: { stars: 5, suns: 0, moons: 0 },
  },

  // ============================================================
  // Template System Configuration
  // ============================================================
  templates: {
    path: env('TEMPLATES_PATH', path.join(DATA_PATH, 'templates')),
    version: env('TEMPLATE_VERSION', 'v3'),
    maxPreviewSize: env('TEMPLATE_MAX_PREVIEW_SIZE', 2 * 1024 * 1024), // 2MB
    categories: [
      'business',
      'startup',
      'portfolio',
      'ecommerce',
      'saas',
      'agency',
      'personal',
      'event',
      'landing',
      'other',
    ],
  },

  // ============================================================
  // Stack Configuration
  // ============================================================
  stacks: {
    default: env('DEFAULT_STACK', 'react-tailwind'),
    supported: envArray('SUPPORTED_STACKS', [
      'react-tailwind',
      'vue-tailwind',
      'html-css',
      'nextjs-tailwind',
    ]),
  },

  // ============================================================
  // Logging Configuration
  // ============================================================
  logging: {
    level: env('LOG_LEVEL', 'info'),
    file: env('LOG_FILE', path.join(LOGS_PATH, 'nexo-lp.log')),
    console: env('LOG_CONSOLE', true),
    maxFiles: env('LOG_MAX_FILES', 5),
    maxSize: env('LOG_MAX_SIZE', '10m'),
  },

  // ============================================================
  // Feature Flags
  // ============================================================
  features: {
    sse: env('ENABLE_SSE', true),
    githubDeploy: env('ENABLE_GITHUB_DEPLOY', true),
    zipFallback: env('ENABLE_ZIP_FALLBACK', true),
    templateMining: env('ENABLE_TEMPLATE_MINING', true),
    bugDetection: env('ENABLE_BUG_DETECTION', true),
    autoRebuild: env('ENABLE_AUTO_REBUILD', true),
    rateLimiting: env('ENABLE_RATE_LIMITING', true),
  },

  // ============================================================
  // Path Constants
  // ============================================================
  paths: {
    data: DATA_PATH,
    logs: LOGS_PATH,
    uploads: path.resolve(__dirname, '../../uploads'),
    webDist: path.resolve(__dirname, '../../nexo-lp-web/dist'),
  },
};

module.exports = config;
