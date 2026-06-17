/**
 * NEXO Landing Page Creator v3.0 - Server Entry Point
 *
 * This is the main Express server that serves:
 * - Static files from nexo-lp-web/dist
 * - API routes at /api/nexo-lp
 * - SSE endpoint for real-time generation events
 * - Health check endpoint
 *
 * @module nexo-lp-server
 * @version 3.0.0
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const fs = require('fs');

const config = require('./config/nexo-lp-config');
const routes = require('./nexo-lp-routes');
const { initializeDatabase } = require('./models/sqlite');

// Ensure required directories exist
const ensureDirectories = () => {
  const dirs = [
    path.resolve(__dirname, '../data'),
    path.resolve(__dirname, '../data/previews'),
    path.resolve(__dirname, '../data/previews/thumbnails'),
    path.resolve(__dirname, '../data/templates'),
    path.resolve(__dirname, '../data/mined-templates'),
    path.resolve(__dirname, '../data/zips'),
    path.resolve(__dirname, '../logs'),
    path.resolve(__dirname, '../uploads'),
  ];
  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

// Initialize Express application
const app = express();
const PORT = config.port;

/**
 * Security middleware configuration
 */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.tailwindcss.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

/**
 * CORS middleware - allow frontend origin
 */
app.use(cors({
  origin: config.corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  credentials: true,
}));

/**
 * Body parsing middleware
 */
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

/**
 * Request logging middleware
 */
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const requestId = req.headers['x-request-id'] || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  req.requestId = requestId;
  console.log(`[${timestamp}] [${requestId}] ${req.method} ${req.path}`);
  next();
});

/**
 * Health check endpoint
 * Returns server status, version, and timestamp
 */
app.get(`${config.apiPrefix}/health`, (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'nexo-lp-creator',
    version: '3.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
    port: PORT,
  });
});

/**
 * SSE endpoint for real-time generation events
 * Clients connect here to receive streaming updates during AI generation
 */
app.get(`${config.apiPrefix}/events/:sessionId`, (req, res) => {
  const { sessionId } = req.params;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Send initial connection event
  res.write(`event: connected\n`);
  res.write(`data: ${JSON.stringify({ sessionId, status: 'connected', timestamp: new Date().toISOString() })}\n\n`);

  // Store the response object so it can be used by the generation service
  const { registerEventStream } = require('./services/lpGenerationService');
  registerEventStream(sessionId, res);

  // Handle client disconnect
  req.on('close', () => {
    console.log(`[SSE] Client disconnected from session: ${sessionId}`);
    const { unregisterEventStream } = require('./services/lpGenerationService');
    unregisterEventStream(sessionId);
  });

  // Send heartbeat every 30 seconds to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(`event: heartbeat\n`);
    res.write(`data: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
  });
});

/**
 * Mount API routes
 */
app.use(config.apiPrefix, routes);

/**
 * Serve static preview files from data/previews
 * (also covers the public subdirectory, so no separate /preview/public mount is needed)
 */
app.use('/preview', express.static(path.resolve(__dirname, '../data/previews')));

/**
 * Serve generated ZIP downloads (restricted to zips subdirectory)
 */
app.use('/download/zips', express.static(path.resolve(__dirname, '../data/zips')));

/**
 * Serve frontend static files (production build)
 * This should be after API routes so they take precedence
 */
const webDistPath = path.resolve(__dirname, '../nexo-lp-web/dist');
if (fs.existsSync(webDistPath)) {
  app.use(express.static(webDistPath));
  // SPA fallback - serve index.html for all non-API routes
  app.get('*', (req, res, next) => {
    if (req.path.startsWith(config.apiPrefix) || req.path.startsWith('/preview') || req.path.startsWith('/download')) {
      return next();
    }
    const indexPath = path.join(webDistPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      next();
    }
  });
} else {
  console.warn('[WARN] Frontend build not found at', webDistPath);
  console.warn('[WARN] Run `npm run build:web` to build the frontend');
}

/**
 * 404 handler for unmatched API routes
 */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Global error handler
 * Catches all unhandled errors and returns structured error response
 */
app.use((err, req, res, next) => {
  const timestamp = new Date().toISOString();
  const requestId = req.requestId || 'unknown';

  console.error(`[${timestamp}] [${requestId}] ERROR:`, err.message);
  console.error(err.stack);

  // Don't leak error details in production
  const isDevelopment = config.nodeEnv === 'development';

  res.status(err.statusCode || 500).json({
    success: false,
    error: {
      message: err.message || 'Internal server error',
      code: err.code || 'INTERNAL_ERROR',
      ...(isDevelopment && { stack: err.stack }),
    },
    requestId,
    timestamp,
  });
});

/**
 * Start the server
 */
const startServer = async () => {
  try {
    // Ensure directories exist
    ensureDirectories();

    // Initialize database
    await initializeDatabase();
    console.log('[DB] Database initialized successfully');

    // Start listening
    app.listen(PORT, () => {
      console.log('=================================================');
      console.log('  NEXO Landing Page Creator v3.0');
      console.log('  Server running on port:', PORT);
      console.log('  Environment:', config.nodeEnv);
      console.log('  API Base:', config.apiPrefix);
      console.log('  Health Check:', `${config.apiPrefix}/health`);
      console.log('=================================================');
    });
  } catch (error) {
    console.error('[FATAL] Failed to start server:', error.message);
    process.exit(1);
  }
};

/**
 * Graceful shutdown handling
 */
const gracefulShutdown = (signal) => {
  console.log(`\n[${signal}] Received shutdown signal. Closing server gracefully...`);

  // Close any open SSE connections
  const { closeAllStreams } = require('./services/lpGenerationService');
  closeAllStreams();

  // Give time for connections to close, then exit
  setTimeout(() => {
    console.log('[SHUTDOWN] Process terminated');
    process.exit(0);
  }, 3000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Start the server unless in test mode
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = app;
