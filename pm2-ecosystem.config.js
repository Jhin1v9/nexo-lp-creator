/**
 * PM2 Ecosystem Configuration for NEXO Landing Page Creator v3.0
 *
 * Hardened configuration: processes are restarted automatically with
 * exponential backoff and high restart limits so the landing page product
 * stays online alongside Luna.
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
        PORT: 3460,
        SANITIZE_CONCURRENCY: 1
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
      kill_timeout: 10000,
      listen_timeout: 20000,
      max_restarts: 50,
      min_uptime: '10s',
      restart_delay: 3000,
      exp_backoff_restart_delay: 100,
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
      kill_timeout: 8000,
      max_restarts: 50,
      min_uptime: '10s',
      restart_delay: 3000,
      exp_backoff_restart_delay: 100,
      autorestart: true,
      vizion: false
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
      kill_timeout: 8000,
      max_restarts: 50,
      min_uptime: '10s',
      restart_delay: 3000,
      exp_backoff_restart_delay: 100,
      autorestart: true,
      vizion: false
    },
    {
      name: 'nexo-lp-web',
      script: './node_modules/.bin/vite',
      args: '--host --port 5174',
      cwd: __dirname + '/nexo-lp-web',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 5174
      },
      log_file: './logs/nexo-lp-web.log',
      error_file: './logs/nexo-lp-web-error.log',
      out_file: './logs/nexo-lp-web-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      kill_timeout: 10000,
      listen_timeout: 20000,
      max_restarts: 50,
      min_uptime: '15s',
      restart_delay: 5000,
      exp_backoff_restart_delay: 100,
      autorestart: true,
      vizion: false
    }
  ]
};
