/**
 * NEXO Landing Page Creator v3.0 - Mining Worker
 *
 * Background worker for template mining pipeline.
 * Processes mining jobs from the queue, scraping URLs and
 * extracting reusable templates.
 *
 * Usage: node workers/mining-worker.js
 *
 * @module workers/mining-worker
 * @version 3.0.0
 */

require('dotenv').config();
const MiningService = require('../services/lpMiningService');

const WORKER_CONFIG = {
  pollIntervalMs: 5000,
  maxConcurrentJobs: 3,
  shutdownTimeoutMs: 10000,
};

let isRunning = true;
let activeJobs = 0;

/**
 * Process the mining queue
 */
async function processQueue() {
  if (!isRunning) return;

  try {
    // The MiningService.processQueue() handles the actual work
    // This worker just keeps triggering it periodically
    await MiningService.processQueue();
  } catch (error) {
    console.error('[MiningWorker] Queue processing error:', error.message);
  }

  // Schedule next poll
  if (isRunning) {
    setTimeout(processQueue, WORKER_CONFIG.pollIntervalMs);
  }
}

/**
 * Graceful shutdown
 */
function gracefulShutdown() {
  console.log('[MiningWorker] Shutting down gracefully...');
  isRunning = false;

  // Wait for active jobs to complete
  const shutdownTimeout = setTimeout(() => {
    console.log('[MiningWorker] Forced shutdown');
    process.exit(1);
  }, WORKER_CONFIG.shutdownTimeoutMs);

  // Check if all jobs are done
  const checkInterval = setInterval(() => {
    if (activeJobs === 0) {
      clearInterval(checkInterval);
      clearTimeout(shutdownTimeout);
      console.log('[MiningWorker] All jobs complete. Exiting.');
      process.exit(0);
    }
  }, 500);
}

// Signal handlers
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

process.on('uncaughtException', (err) => {
  console.error('[MiningWorker] Uncaught exception:', err.message);
  gracefulShutdown();
});

process.on('unhandledRejection', (reason) => {
  console.error('[MiningWorker] Unhandled rejection:', reason);
});

// Start worker
async function start() {
  console.log('=================================================');
  console.log('  NEXO Mining Worker');
  console.log('  Polling interval:', WORKER_CONFIG.pollIntervalMs, 'ms');
  console.log('=================================================');

  await processQueue();
}

start().catch((error) => {
  console.error('[MiningWorker] Fatal error:', error.message);
  process.exit(1);
});
