/**
 * PM2 Ecosystem Configuration for NEXO Landing Page Creator v3.0
 * 
 * This configuration manages the main server process, workers,
 * and ensures graceful startup/shutdown behavior.
 */

module.exports = {
  apps: [
    {
      name: 'nexo-lp-server',
      script: './nexo-lp-server/nexo-lp-server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3460
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3460,
        watch: true,
        ignore_watch: ['node_modules', 'logs', 'data', 'previews']
      },
      log_file: './logs/nexo-lp-server.log',
      error_file: './logs/nexo-lp-server-error.log',
      out_file: './logs/nexo-lp-server-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      kill_timeout: 5000,
      listen_timeout: 10000,
      max_restarts: 5,
      min_uptime: '10s',
      restart_delay: 3000,
      autorestart: true,
      vizion: false
    },
    {
      name: 'nexo-mining-worker',
      script: './nexo-lp-server/workers/mining-worker.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production'
      },
      log_file: './logs/mining-worker.log',
      error_file: './logs/mining-worker-error.log',
      out_file: './logs/mining-worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      kill_timeout: 5000,
      autorestart: true
    },
    {
      name: 'nexo-screenshot-worker',
      script: './nexo-lp-server/workers/screenshot-worker.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production'
      },
      log_file: './logs/screenshot-worker.log',
      error_file: './logs/screenshot-worker-error.log',
      out_file: './logs/screenshot-worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      kill_timeout: 5000,
      autorestart: true
    }
  ]
};
