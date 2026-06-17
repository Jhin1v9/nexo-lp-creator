/**
 * NEXO Landing Page Creator v3.0 - API Routes
 *
 * Defines all RESTful API endpoints for the landing page creator.
 * All routes are mounted at /api/nexo-lp by the server.
 *
 * Endpoints:
 *   GET    /sessions              - List recent sessions
 *   POST   /sessions              - Create new session
 *   GET    /sessions/:id          - Get session by ID
 *   POST   /generate              - Start generation (SSE stream)
 *   GET    /preview/:sessionId    - Get generated HTML preview
 *   POST   /bug-detect            - Run bug detection
 *   POST   /rebuild               - Rebuild with fixes
 *   GET    /tokens/balance        - Get token balance
 *   POST   /tokens/deduct         - Deduct tokens
 *   POST   /deploy/github         - Deploy to GitHub Pages
 *   GET    /templates             - List all templates
 *   POST   /templates/:id/use     - Use a template
 *   POST   /mining/submit         - Submit URL for template mining
 *   GET    /mining/:jobId/status  - Check mining status
 *
 * @module nexo-lp-routes
 * @version 3.0.0
 */

const express = require('express');
const router = express.Router();

// Import services
const lpSessionService = require('./services/lpSessionService');
const lpGenerationService = require('./services/lpGenerationService');
const lpPreviewService = require('./services/lpPreviewService');
const lpBugDetectorService = require('./services/lpBugDetectorService');
const lpRebuildEngine = require('./services/lpRebuildEngine');
const lpTokenService = require('./services/lpTokenService');
const lpDeployService = require('./services/lpDeployService');
const lpTemplateService = require('./services/lpTemplateService');
const lpMiningService = require('./services/lpMiningService');
const lpVersionService = require('./services/lpVersionService');
const lpCurrencyService = require('./services/lpCurrencyService');

/**
 * Helper: Async handler wrapper to catch errors in async route handlers
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Helper: Standard success response formatter
 */
const successResponse = (data, message = 'Success') => ({
  success: true,
  message,
  data,
  timestamp: new Date().toISOString(),
});

/**
 * Helper: Standard error response formatter
 */
const errorResponse = (message, code = 'ERROR', statusCode = 400) => ({
  success: false,
  error: { message, code },
  timestamp: new Date().toISOString(),
  statusCode,
});

// ============================================================
// SESSION ROUTES
// ============================================================

/**
 * POST /sessions
 * Create a new landing page creation session
 *
 * Body: { userId?, initialPrompt?, stack? }
 * Response: { success, data: { sessionId, status, createdAt } }
 */
router.post('/sessions', asyncHandler(async (req, res) => {
  const { userId, initialPrompt, stack } = req.body;

  const session = await lpSessionService.createSession({
    userId: userId || `anonymous-${Date.now()}`,
    initialPrompt: initialPrompt || '',
    stack: stack || 'react-tailwind',
    status: 'created',
  });

  const contextInfo = await lpSessionService.getContextInfo(session);
  res.status(201).json(successResponse({ ...session, ...contextInfo }, 'Session created successfully'));
}));

/**
 * GET /sessions
 * List recent sessions with optional filters
 *
 * Query: { userId?, status?, page?, limit? }
 * Response: { success, data: { sessions, page, limit, total } }
 */
router.get('/sessions', asyncHandler(async (req, res) => {
  const { userId, status, page = '1', limit = '20' } = req.query;
  const filters = {};
  if (userId) filters.userId = userId;
  if (status) filters.status = status;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const sessions = await lpSessionService.listSessions(filters, pageNum, limitNum);
  const total = await lpSessionService.getTotalCount();

  const sessionsWithContext = await Promise.all(
    sessions.map(async (session) => {
      const contextInfo = await lpSessionService.getContextInfo(session);
      return { ...session, ...contextInfo };
    })
  );

  res.status(200).json(successResponse({
    sessions: sessionsWithContext,
    page: pageNum,
    limit: limitNum,
    total,
  }, 'Sessions retrieved successfully'));
}));

/**
 * GET /sessions/:id
 * Get session details by ID
 *
 * Response: { success, data: { session object } }
 */
router.get('/sessions/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const session = await lpSessionService.getSessionById(id);

  if (!session) {
    return res.status(404).json(errorResponse('Session not found', 'NOT_FOUND', 404));
  }

  const contextInfo = await lpSessionService.getContextInfo(session);
  res.status(200).json(successResponse({ ...session, ...contextInfo }, 'Session retrieved successfully'));
}));

/**
 * GET /sessions/:id/messages
 * Get chat messages for a session
 */
router.get('/sessions/:id/messages', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const session = await lpSessionService.getSessionById(id);

  if (!session) {
    return res.status(404).json(errorResponse('Session not found', 'NOT_FOUND', 404));
  }

  const messages = await lpSessionService.getMessages(id);
  res.status(200).json(successResponse(messages, 'Messages retrieved successfully'));
}));

/**
 * POST /sessions/:id/messages
 * Add a chat message to a session
 */
router.post('/sessions/:id/messages', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role, content, type, metadata } = req.body;

  const session = await lpSessionService.getSessionById(id);
  if (!session) {
    return res.status(404).json(errorResponse('Session not found', 'NOT_FOUND', 404));
  }

  const message = await lpSessionService.addMessage(id, { role, content, type, metadata });
  res.status(201).json(successResponse(message, 'Message added successfully'));
}));

/**
 * PATCH /sessions/:id
 * Rename a session (updates its title/initial prompt)
 */
router.patch('/sessions/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title } = req.body;

  const session = await lpSessionService.getSessionById(id);
  if (!session) {
    return res.status(404).json(errorResponse('Session not found', 'NOT_FOUND', 404));
  }

  const updated = await lpSessionService.renameSession(id, title);
  res.status(200).json(successResponse(updated, 'Session renamed successfully'));
}));

/**
 * DELETE /sessions/:id
 * Delete a session and all its messages
 */
router.delete('/sessions/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const session = await lpSessionService.getSessionById(id);
  if (!session) {
    return res.status(404).json(errorResponse('Session not found', 'NOT_FOUND', 404));
  }

  await lpSessionService.clearMessages(id);
  await lpSessionService.deleteSession(id);
  res.status(200).json(successResponse({ deleted: true }, 'Session deleted successfully'));
}));

/**
 * GET /sessions/:id/download
 * Download the chat history as a JSON file
 */
router.get('/sessions/:id/download', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const session = await lpSessionService.getSessionById(id);
  if (!session) {
    return res.status(404).json(errorResponse('Session not found', 'NOT_FOUND', 404));
  }

  const messages = await lpSessionService.getMessages(id);
  const payload = {
    sessionId: id,
    title: session.initial_prompt || 'Untitled',
    createdAt: session.created_at,
    updatedAt: session.updated_at,
    messages,
  };

  const filename = `nexo-lp-chat-${id}.json`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(payload, null, 2));
}));

// ============================================================
// VERSION ROUTES
// ============================================================

/**
 * GET /sessions/:id/versions
 * List versions for a session
 */
router.get('/sessions/:id/versions', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const session = await lpSessionService.getSessionById(id);
  if (!session) {
    return res.status(404).json(errorResponse('Session not found', 'NOT_FOUND', 404));
  }
  const versions = await lpVersionService.listVersions(id);
  res.status(200).json(successResponse(versions, 'Versions retrieved successfully'));
}));

/**
 * POST /sessions/:id/versions
 * Save a new version for a session
 */
router.post('/sessions/:id/versions', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { html, css, js, note, metadata } = req.body;

  const session = await lpSessionService.getSessionById(id);
  if (!session) {
    return res.status(404).json(errorResponse('Session not found', 'NOT_FOUND', 404));
  }

  const version = await lpVersionService.saveVersion(id, {
    html: html || session.current_html,
    css,
    js,
    note,
    metadata,
  });

  res.status(201).json(successResponse(version, 'Version saved successfully'));
}));

/**
 * POST /sessions/:id/versions/:versionId/rollback
 * Roll back a session to a specific version
 */
router.post('/sessions/:id/versions/:versionId/rollback', asyncHandler(async (req, res) => {
  const { id, versionId } = req.params;

  const session = await lpSessionService.getSessionById(id);
  if (!session) {
    return res.status(404).json(errorResponse('Session not found', 'NOT_FOUND', 404));
  }

  const version = await lpVersionService.rollbackVersion(id, versionId);
  res.status(200).json(successResponse(version, 'Rollback successful'));
}));

/**
 * DELETE /sessions/:id/versions/:versionId
 * Delete a version
 */
router.delete('/sessions/:id/versions/:versionId', asyncHandler(async (req, res) => {
  const { id, versionId } = req.params;

  const session = await lpSessionService.getSessionById(id);
  if (!session) {
    return res.status(404).json(errorResponse('Session not found', 'NOT_FOUND', 404));
  }

  await lpVersionService.deleteVersion(id, versionId);
  res.status(200).json(successResponse({ deleted: true }, 'Version deleted successfully'));
}));

// ============================================================
// GENERATION ROUTES
// ============================================================

/**
 * POST /generate
 * Start the AI generation process
 * Returns immediately with sessionId; client should connect to SSE
 *
 * Body: { sessionId, prompt, stack?, options? }
 * Response: { success, data: { sessionId, status, eventStreamUrl } }
 */
router.post('/generate', asyncHandler(async (req, res) => {
  const { sessionId, prompt, stack, options = {} } = req.body;
  const mode = options.mode || 'stars';

  if (!sessionId) {
    return res.status(400).json(errorResponse('sessionId is required', 'MISSING_PARAM', 400));
  }

  if (!prompt) {
    return res.status(400).json(errorResponse('prompt is required', 'MISSING_PARAM', 400));
  }

  const session = await lpSessionService.getSessionById(sessionId);
  if (!session) {
    return res.status(404).json(errorResponse('Session not found', 'NOT_FOUND', 404));
  }

  // Charge the user for this generation
  const userId = session.user_id;
  try {
    const chargeResult = await lpCurrencyService.charge(userId, 'generate', mode);
    console.log(`[Routes] Charged user ${userId} for ${mode}:`, chargeResult.cost);
  } catch (error) {
    return res.status(402).json(errorResponse(error.message, 'INSUFFICIENT_CURRENCY', 402));
  }

  // Start generation in the background; respond immediately with 202
  lpGenerationService.startGeneration(sessionId, prompt, stack, options).catch((error) => {
    console.error('[Routes] Background generation failed:', error.message);
  });

  const contextInfo = await lpSessionService.getContextInfo(session);
  res.status(202).json(successResponse({
    sessionId,
    status: 'generating',
    mode,
    eventStreamUrl: `/api/nexo-lp/events/${sessionId}`,
    ...contextInfo,
  }, 'Generation started. Connect to SSE for updates.'));
}));

// ============================================================
// PREVIEW ROUTES
// ============================================================

/**
 * GET /preview/:sessionId
 * Get the generated HTML preview for a session
 *
 * Response: HTML content or { success, data: { html, screenshotUrl } }
 */
router.get('/preview/:sessionId', asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { raw } = req.query;

  const preview = await lpPreviewService.getPreview(sessionId);

  if (!preview) {
    return res.status(404).json(errorResponse('Preview not found', 'NOT_FOUND', 404));
  }

  if (raw === 'true') {
    // Return raw HTML
    res.setHeader('Content-Type', 'text/html');
    return res.send(preview.html);
  }

  res.status(200).json(successResponse(preview, 'Preview retrieved successfully'));
}));

/**
 * POST /preview/:sessionId
 * Save or update the generated HTML preview for a session
 *
 * Body: { html, assets? }
 * Response: { success, data: { sessionId, previewUrl, savedAt } }
 */
router.post('/preview/:sessionId', asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { html, assets } = req.body;

  if (!html) {
    return res.status(400).json(errorResponse('html is required', 'MISSING_PARAM', 400));
  }

  const preview = await lpPreviewService.savePreview(sessionId, html, assets || {});
  await lpSessionService.updateGeneratedCode(sessionId, { html, css: assets?.css || '', js: assets?.js || '' });

  res.status(200).json(successResponse(preview, 'Preview saved successfully'));
}));

// ============================================================
// BUG DETECTION ROUTES
// ============================================================

/**
 * POST /bug-detect
 * Run bug detection on generated HTML
 *
 * Body: { sessionId, html? }
 * Response: { success, data: { score, issues, summary } }
 */
router.post('/bug-detect', asyncHandler(async (req, res) => {
  const { sessionId, html } = req.body;

  if (!sessionId) {
    return res.status(400).json(errorResponse('sessionId is required', 'MISSING_PARAM', 400));
  }

  const report = await lpBugDetectorService.detect(sessionId, html);

  res.status(200).json(successResponse(report, 'Bug detection completed'));
}));

// ============================================================
// REBUILD ROUTES
// ============================================================

/**
 * POST /rebuild
 * Rebuild landing page with automatic bug fixes
 *
 * Body: { sessionId, html, bugs, maxAttempts? }
 * Response: { success, data: { html, fixesApplied, attemptsUsed } }
 */
router.post('/rebuild', asyncHandler(async (req, res) => {
  const { sessionId, html, bugs, maxAttempts } = req.body;

  if (!sessionId) {
    return res.status(400).json(errorResponse('sessionId is required', 'MISSING_PARAM', 400));
  }

  if (!html) {
    return res.status(400).json(errorResponse('html is required', 'MISSING_PARAM', 400));
  }

  if (!bugs || !Array.isArray(bugs) || bugs.length === 0) {
    return res.status(400).json(errorResponse('bugs array is required', 'MISSING_PARAM', 400));
  }

  const result = await lpRebuildEngine.rebuild(sessionId, html, bugs, maxAttempts);

  // Persist rebuilt HTML and snapshot a version if fixes were applied
  if (result.html && result.html !== html) {
    await lpPreviewService.savePreview(sessionId, result.html);
    await lpSessionService.updateGeneratedCode(sessionId, { html: result.html, css: '', js: '' });
    try {
      await lpVersionService.snapshot(sessionId, 'rebuild');
    } catch (err) {
      console.error(`[Routes] version snapshot after rebuild failed:`, err.message);
    }
  }

  res.status(200).json(successResponse(result, 'Rebuild completed'));
}));

// ============================================================
// TOKEN ROUTES
// ============================================================

/**
 * GET /tokens/balance
 * Get token balance for a user
 *
 * Query: { userId }
 * Response: { success, data: { userId, balance } }
 */
router.get('/tokens/balance', asyncHandler(async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json(errorResponse('userId is required', 'MISSING_PARAM', 400));
  }

  const balance = await lpTokenService.getBalance(userId);

  res.status(200).json(successResponse({ userId, balance }, 'Token balance retrieved'));
}));

/**
 * POST /tokens/deduct
 * Deduct tokens for an action
 *
 * Body: { userId, amount, action }
 * Response: { success, data: { userId, deducted, remaining } }
 */
router.post('/tokens/deduct', asyncHandler(async (req, res) => {
  const { userId, amount, action } = req.body;

  if (!userId) {
    return res.status(400).json(errorResponse('userId is required', 'MISSING_PARAM', 400));
  }

  if (typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json(errorResponse('Valid amount is required', 'INVALID_PARAM', 400));
  }

  const result = await lpTokenService.deduct(userId, amount, action);

  if (!result.success) {
    return res.status(402).json(errorResponse(result.error, 'INSUFFICIENT_TOKENS', 402));
  }

  res.status(200).json(successResponse({
    userId,
    deducted: amount,
    remaining: result.remaining,
    action,
  }, 'Tokens deducted successfully'));
}));

// ============================================================
// CURRENCY ROUTES
// ============================================================

/**
 * GET /currencies/balance
 * Get virtual currency balance for a user
 *
 * Query: { userId }
 * Response: { success, data: { userId, stars, suns, moons } }
 */
router.get('/currencies/balance', asyncHandler(async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json(errorResponse('userId is required', 'MISSING_PARAM', 400));
  }

  const balance = await lpCurrencyService.getBalance(userId);
  res.status(200).json(successResponse(balance, 'Currency balance retrieved'));
}));

/**
 * POST /currencies/deduct
 * Deduct virtual currencies for an action (admin/debug use)
 *
 * Body: { userId, operation, mode? }
 * Response: { success, data: { oldBalance, newBalance, cost } }
 */
router.post('/currencies/deduct', asyncHandler(async (req, res) => {
  const { userId, operation, mode } = req.body;

  if (!userId) {
    return res.status(400).json(errorResponse('userId is required', 'MISSING_PARAM', 400));
  }

  if (!operation) {
    return res.status(400).json(errorResponse('operation is required', 'MISSING_PARAM', 400));
  }

  try {
    const result = await lpCurrencyService.charge(userId, operation, mode);
    res.status(200).json(successResponse(result, 'Currency deducted successfully'));
  } catch (error) {
    return res.status(402).json(errorResponse(error.message, 'INSUFFICIENT_CURRENCY', 402));
  }
}));

// ============================================================
// DEPLOYMENT ROUTES
// ============================================================

/**
 * POST /deploy/github
 * Deploy landing page to GitHub Pages
 *
 * Body: { sessionId, repo?, branch?, message? }
 * Response: { success, data: { url, branch, commit } }
 */
router.post('/deploy/github', asyncHandler(async (req, res) => {
  const { sessionId, repo, branch, message } = req.body;

  if (!sessionId) {
    return res.status(400).json(errorResponse('sessionId is required', 'MISSING_PARAM', 400));
  }

  const result = await lpDeployService.deployToGitHub(sessionId, { repo, branch, message });

  if (!result.success) {
    return res.status(500).json(errorResponse(result.error, 'DEPLOY_FAILED', 500));
  }

  res.status(200).json(successResponse(result, 'Deployed successfully'));
}));

/**
 * POST /deploy/zip
 * Generate ZIP file for download (fallback deployment)
 *
 * Body: { sessionId }
 * Response: { success, data: { downloadUrl, filename } }
 */
router.post('/deploy/zip', asyncHandler(async (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json(errorResponse('sessionId is required', 'MISSING_PARAM', 400));
  }

  const result = await lpDeployService.createZip(sessionId);

  if (!result.success) {
    return res.status(500).json(errorResponse(result.error, 'ZIP_FAILED', 500));
  }

  res.status(200).json(successResponse(result, 'ZIP created successfully'));
}));

// ============================================================
// TEMPLATE ROUTES
// ============================================================

/**
 * GET /templates
 * List all available templates
 *
 * Query: { category?, stack?, search?, page?, limit? }
 * Response: { success, data: { templates, pagination } }
 */
router.get('/templates', asyncHandler(async (req, res) => {
  const { category, stack, search, page = 1, limit = 20 } = req.query;

  const filters = {};
  if (category) filters.category = category;
  if (stack) filters.stack = stack;
  if (search) filters.search = search;

  const result = await lpTemplateService.listTemplates(filters, parseInt(page), parseInt(limit));

  res.status(200).json(successResponse(result, 'Templates retrieved successfully'));
}));

/**
 * GET /templates/:id
 * Get a single template by ID
 */
router.get('/templates/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const template = await lpTemplateService.getTemplateById(id);

  if (!template) {
    return res.status(404).json(errorResponse('Template not found', 'NOT_FOUND', 404));
  }

  res.status(200).json(successResponse(template, 'Template retrieved successfully'));
}));

/**
 * POST /templates/:id/use
 * Use a template as starting point for a new session
 *
 * Body: { userId? }
 * Response: { success, data: { sessionId, templateId, status } }
 */
router.post('/templates/:id/use', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  const result = await lpTemplateService.useTemplate(id, userId || `anonymous-${Date.now()}`);

  res.status(201).json(successResponse(result, 'Template applied. New session created.'));
}));

/**
 * POST /templates/:id/buy
 * Buy a template from the LOJA
 *
 * Body: { userId }
 * Response: { success, data: purchase }
 */
router.post('/templates/:id/buy', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json(errorResponse('userId is required', 'MISSING_PARAM', 400));
  }

  const template = await lpTemplateService.getTemplateById(id);
  if (!template) {
    return res.status(404).json(errorResponse('Template not found', 'NOT_FOUND', 404));
  }

  const purchase = await lpTemplateService.buyTemplate(id, userId);
  res.status(200).json(successResponse(purchase, 'Template purchased successfully'));
}));

/**
 * GET /templates/:id/prompt
 * Get the original or censored prompt for a template
 *
 * Query: { userId }
 * Response: { success, data: { unlocked, prompt, censored } }
 */
router.get('/templates/:id/prompt', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json(errorResponse('userId is required', 'MISSING_PARAM', 400));
  }

  const template = await lpTemplateService.getTemplateById(id);
  if (!template) {
    return res.status(404).json(errorResponse('Template not found', 'NOT_FOUND', 404));
  }

  const prompt = await lpTemplateService.getTemplatePrompt(id, userId);
  res.status(200).json(successResponse(prompt, 'Prompt retrieved'));
}));

/**
 * POST /preview/:sessionId/public
 * Publish a public preview for a session
 *
 * Body: { userId }
 * Response: { success, data: { token, url } }
 */
router.post('/preview/:sessionId/public', asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json(errorResponse('userId is required', 'MISSING_PARAM', 400));
  }

  const session = await lpSessionService.getSessionById(sessionId);
  if (!session) {
    return res.status(404).json(errorResponse('Session not found', 'NOT_FOUND', 404));
  }

  if (session.user_id !== userId) {
    return res.status(403).json(errorResponse('Unauthorized', 'UNAUTHORIZED', 403));
  }

  if (!session.current_html) {
    return res.status(400).json(errorResponse('Session has no HTML preview', 'MISSING_PREVIEW', 400));
  }

  const { token, url } = await lpPreviewService.publishPublicPreview(sessionId, session.current_html);
  res.status(201).json(successResponse({ token, url }, 'Public preview published'));
}));

// ============================================================
// MINING ROUTES
// ============================================================

/**
 * POST /mining/submit
 * Submit a URL for template mining
 *
 * Body: { url, userId? }
 * Response: { success, data: { jobId, status, queuePosition } }
 */
router.post('/mining/submit', asyncHandler(async (req, res) => {
  const { url, userId } = req.body;

  if (!url) {
    return res.status(400).json(errorResponse('url is required', 'MISSING_PARAM', 400));
  }

  // Basic URL validation
  try {
    new URL(url);
  } catch {
    return res.status(400).json(errorResponse('Invalid URL format', 'INVALID_URL', 400));
  }

  const result = await lpMiningService.submitUrl(url, userId || `anonymous-${Date.now()}`);

  res.status(202).json(successResponse(result, 'Mining job submitted successfully'));
}));

/**
 * GET /mining/:jobId/status
 * Check the status of a mining job
 *
 * Response: { success, data: { jobId, status, progress, result? } }
 */
router.get('/mining/:jobId/status', asyncHandler(async (req, res) => {
  const { jobId } = req.params;

  const status = await lpMiningService.getJobStatus(jobId);

  if (!status) {
    return res.status(404).json(errorResponse('Mining job not found', 'NOT_FOUND', 404));
  }

  res.status(200).json(successResponse(status, 'Mining job status retrieved'));
}));

/**
 * GET /mining/:jobId/result
 * Get the result of a completed mining job
 *
 * Response: { success, data: { jobId, template, components } }
 */
router.get('/mining/:jobId/result', asyncHandler(async (req, res) => {
  const { jobId } = req.params;

  const result = await lpMiningService.getJobResult(jobId);

  if (!result) {
    return res.status(404).json(errorResponse('Mining job result not found', 'NOT_FOUND', 404));
  }

  res.status(200).json(successResponse(result, 'Mining job result retrieved'));
}));

// ============================================================
// STACK ROUTES
// ============================================================

/**
 * GET /stacks
 * List all supported technology stacks
 *
 * Response: { success, data: { stacks } }
 */
router.get('/stacks', asyncHandler(async (req, res) => {
  const lpStackService = require('./services/lpStackService');
  const stacks = lpStackService.listSupportedStacks();

  res.status(200).json(successResponse({ stacks }, 'Supported stacks retrieved'));
}));

/**
 * POST /stacks/validate
 * Validate a stack configuration
 *
 * Body: { stack, requirements? }
 * Response: { success, data: { valid, errors, warnings } }
 */
router.post('/stacks/validate', asyncHandler(async (req, res) => {
  const { stack, requirements } = req.body;

  if (!stack) {
    return res.status(400).json(errorResponse('stack is required', 'MISSING_PARAM', 400));
  }

  const lpStackService = require('./services/lpStackService');
  const result = lpStackService.validateStack(stack, requirements);

  res.status(200).json(successResponse(result, 'Stack validation completed'));
}));

module.exports = router;
