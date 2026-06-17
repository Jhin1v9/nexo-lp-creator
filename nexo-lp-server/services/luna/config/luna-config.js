/**
 * Luna Config for NEXO Landing Page Creator
 * Isolates the Kimi bridge from the main Luna dashboard Chrome instance.
 */
const path = require('path');
const os = require('os');

const HOME_DIR = os.homedir();
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const NEXO_LP_DATA = path.join(PROJECT_ROOT, 'data');

const CDP_PORT = parseInt(process.env.KIMI_CDP_PORT, 10) || 9226;

const PORTS = {
  luna: parseInt(process.env.PORT, 10) || 3460,
  dashboard: parseInt(process.env.DASHBOARD_PORT, 10) || 3456,
  caddyHttp: parseInt(process.env.CADDY_HTTP_PORT, 10) || 8080,
  caddyHttps: parseInt(process.env.CADDY_HTTPS_PORT, 10) || 5173,
};

const URLS = {
  dashboard: process.env.DASHBOARD_URL || `http://localhost:${PORTS.dashboard}`,
  luna: process.env.LUNA_URL || `http://localhost:${PORTS.luna}`,
};

const TIMEOUTS = {
  kimi: parseInt(process.env.KIMI_TIMEOUT, 10) || 120000,
  kimiIdle: parseInt(process.env.KIMI_IDLE_TIMEOUT, 10) || 10 * 60 * 1000,
  kimiCooldown: parseInt(process.env.KIMI_COOLDOWN_MS, 10) || 5000,
  sseReconnectBase: 1000,
  sseReconnectMax: 30000,
  heartbeatInterval: 30000,
};

const PATHS = {
  lunaDist: path.join(PROJECT_ROOT, 'nexo-lp-web', 'dist'),
  dashboardPublic: path.join(PROJECT_ROOT, 'nexo-lp-web', 'public'),
  dashboardData: NEXO_LP_DATA,
  sessions: path.join(NEXO_LP_DATA, 'sessions'),
  artifacts: path.join(NEXO_LP_DATA, 'artifacts'),
  env: path.join(PROJECT_ROOT, '.env'),
};

const KIMI = {
  maxPages: parseInt(process.env.KIMI_MAX_PAGES, 10) || 1,
  maxTextTypeLength: parseInt(process.env.KIMI_MAX_TYPE_LENGTH, 10) || 500,
  logMaxSizeMB: parseInt(process.env.KIMI_LOG_MAX_MB, 10) || 10,
  persistentMode: process.env.KIMI_PERSISTENT_MODE === 'true' || process.env.KIMI_PERSISTENT_MODE === '1',
  cdpPorts: [CDP_PORT],
  modeUrls: {
    instant: 'https://www.kimi.com/?chat_enter_method=new_chat&lang=en',
    thinking: 'https://www.kimi.com/?chat_enter_method=new_chat&lang=en',
    agent: 'https://www.kimi.com/agent?lang=en',
    swarm: 'https://www.kimi.com/agent-swarm?lang=en',
  },
};

const FEATURES = {
  enableCache: process.env.ENABLE_CACHE !== 'false',
  enableDebug: process.env.NODE_ENV === 'development',
};

module.exports = {
  HOME_DIR,
  PORTS,
  URLS,
  TIMEOUTS,
  PATHS,
  KIMI,
  FEATURES,
};
