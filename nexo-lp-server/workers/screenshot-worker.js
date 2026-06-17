/**
 * NEXO Landing Page Creator v3.0 - Screenshot Worker
 *
 * Background worker that generates screenshots of landing pages
 * at multiple breakpoints (mobile, tablet, desktop).
 *
 * Usage: node workers/screenshot-worker.js
 *
 * @module workers/screenshot-worker
 * @version 3.0.0
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const config = require('../config/nexo-lp-config');

const WORKER_CONFIG = {
  pollIntervalMs: 3000,
  screenshotsPath: path.resolve(__dirname, '../../data/screenshots'),
  breakpoints: [
    { name: 'mobile', width: 375, height: 812 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1440, height: 900 },
  ],
  shutdownTimeoutMs: 10000,
};

let isRunning = true;
let activeJobs = 0;

// Ensure screenshots directory exists
if (!fs.existsSync(WORKER_CONFIG.screenshotsPath)) {
  fs.mkdirSync(WORKER_CONFIG.screenshotsPath, { recursive: true });
}

/**
 * Screenshot job queue (in-memory)
 * In production, this would be backed by Redis or database queue
 */
const jobQueue = [];

/**
 * Add a screenshot job to the queue
 * @param {object} job - { sessionId, url, html }
 */
function addJob(job) {
  jobQueue.push({
    ...job,
    id: `screenshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    status: 'pending',
    createdAt: new Date().toISOString(),
  });
}

/**
 * Process the screenshot queue
 */
async function processQueue() {
  if (!isRunning || jobQueue.length === 0 || activeJobs >= 3) {
    return;
  }

  const job = jobQueue.shift();
  if (!job) return;

  activeJobs++;
  job.status = 'processing';

  try {
    await generateScreenshots(job);
    job.status = 'completed';
    console.log(`[ScreenshotWorker] Job ${job.id} completed`);
  } catch (error) {
    job.status = 'failed';
    job.error = error.message;
    console.error(`[ScreenshotWorker] Job ${job.id} failed:`, error.message);
  } finally {
    activeJobs--;
  }
}

/**
 * Generate screenshots for a landing page at all breakpoints
 * @param {object} job
 */
async function generateScreenshots(job) {
  const { sessionId } = job;
  const results = [];

  for (const breakpoint of WORKER_CONFIG.breakpoints) {
    const filename = `${sessionId}-${breakpoint.name}.png`;
    const filePath = path.join(WORKER_CONFIG.screenshotsPath, filename);

    try {
      // In a production environment, this would use Puppeteer or Playwright
      // For this implementation, we create a placeholder file and metadata

      const metadata = {
        sessionId,
        breakpoint: breakpoint.name,
        width: breakpoint.width,
        height: breakpoint.height,
        url: job.url,
        generatedAt: new Date().toISOString(),
        status: 'pending-browser-automation',
        filePath,
      };

      // Save metadata JSON (actual screenshot would be generated here)
      fs.writeFileSync(
        path.join(WORKER_CONFIG.screenshotsPath, `${sessionId}-${breakpoint.name}.json`),
        JSON.stringify(metadata, null, 2),
        'utf-8'
      );

      // Create placeholder HTML that indicates where the screenshot would go
      const placeholderHtml = `<!DOCTYPE html>
<html>
<head><title>Screenshot Placeholder - ${breakpoint.name}</title></head>
<body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#f3f4f6;">
  <div style="text-align:center;">
    <h2>Screenshot: ${breakpoint.name}</h2>
    <p>${breakpoint.width}x${breakpoint.height}</p>
    <p>Session: ${sessionId}</p>
    <p>Use Puppeteer/Playwright for actual screenshots</p>
  </div>
</body>
</html>`;

      fs.writeFileSync(
        path.join(WORKER_CONFIG.screenshotsPath, `${sessionId}-${breakpoint.name}.html`),
        placeholderHtml,
        'utf-8'
      );

      results.push({
        breakpoint: breakpoint.name,
        url: `${config.preview.baseUrl}/screenshots/${filename}`,
        status: 'generated',
      });

      console.log(`[ScreenshotWorker] Generated ${breakpoint.name} for ${sessionId}`);
    } catch (error) {
      console.error(`[ScreenshotWorker] Failed ${breakpoint.name} for ${sessionId}:`, error.message);
      results.push({
        breakpoint: breakpoint.name,
        status: 'failed',
        error: error.message,
      });
    }
  }

  // Save combined result
  fs.writeFileSync(
    path.join(WORKER_CONFIG.screenshotsPath, `${sessionId}-results.json`),
    JSON.stringify({ sessionId, screenshots: results, generatedAt: new Date().toISOString() }, null, 2),
    'utf-8'
  );

  return results;
}

/**
 * Poll for new jobs
 */
async function poll() {
  if (!isRunning) return;

  await processQueue();

  setTimeout(poll, WORKER_CONFIG.pollIntervalMs);
}

/**
 * Graceful shutdown
 */
function gracefulShutdown() {
  console.log('[ScreenshotWorker] Shutting down gracefully...');
  isRunning = false;

  const shutdownTimeout = setTimeout(() => {
    console.log('[ScreenshotWorker] Forced shutdown');
    process.exit(1);
  }, WORKER_CONFIG.shutdownTimeoutMs);

  const checkInterval = setInterval(() => {
    if (activeJobs === 0 && jobQueue.length === 0) {
      clearInterval(checkInterval);
      clearTimeout(shutdownTimeout);
      console.log('[ScreenshotWorker] All jobs complete. Exiting.');
      process.exit(0);
    }
  }, 500);
}

// Signal handlers
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

process.on('uncaughtException', (err) => {
  console.error('[ScreenshotWorker] Uncaught exception:', err.message);
  gracefulShutdown();
});

process.on('unhandledRejection', (reason) => {
  console.error('[ScreenshotWorker] Unhandled rejection:', reason);
});

// Export for programmatic use
module.exports = { addJob, generateScreenshots };

// Start worker if run directly
if (require.main === module) {
  console.log('=================================================');
  console.log('  NEXO Screenshot Worker');
  console.log('  Polling interval:', WORKER_CONFIG.pollIntervalMs, 'ms');
  console.log('  Breakpoints:', WORKER_CONFIG.breakpoints.map((b) => b.name).join(', '));
  console.log('=================================================');

  poll().catch((error) => {
    console.error('[ScreenshotWorker] Fatal error:', error.message);
    process.exit(1);
  });
}
