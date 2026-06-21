/**
 * NEXO Landing Page Creator v3.0 - Admin Routes
 *
 * Administrative API endpoints for the Command Center.
 *
 * @module routes/adminRoutes
 * @version 3.0.0
 */

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const requireAdmin = require('../security/adminAuth');

/**
 * Helper: Async handler wrapper to catch errors in async route handlers
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Public read-only settings endpoint used by the editor's generation mode switch.
// All other /admin endpoints require a valid admin token.
// Server-Sent Events (/events) authenticate via the adminToken query parameter
// because EventSource cannot send custom headers.
router.get('/settings', asyncHandler(adminController.getSettings));

router.use(requireAdmin);

// ============================================================
// DASHBOARD
// ============================================================
router.get('/stats', asyncHandler(adminController.getStats));

// ============================================================
// LIVE EVENTS (SSE)
// ============================================================
router.get('/events', asyncHandler(adminController.streamAdminEvents));

// ============================================================
// TEMPLATES
// ============================================================
router.get('/templates', asyncHandler(adminController.listTemplates));
router.patch('/templates/:id', asyncHandler(adminController.updateTemplate));
router.post('/templates/:id/approve', asyncHandler(adminController.approveTemplate));
router.delete('/templates/:id', asyncHandler(adminController.deleteTemplate));
router.post('/templates/:id/sanitize', asyncHandler(adminController.sanitizeTemplate));

// ============================================================
// SESSIONS
// ============================================================
router.get('/sessions', asyncHandler(adminController.listSessions));
router.post('/sessions/:id/regenerate', asyncHandler(adminController.regenerateSession));
router.delete('/sessions/:id', asyncHandler(adminController.deleteSession));

// ============================================================
// PURCHASES
// ============================================================
router.get('/purchases', asyncHandler(adminController.listPurchases));

// ============================================================
// CURRENCY
// ============================================================
router.post('/currency/credit', asyncHandler(adminController.creditCurrency));
router.post('/currency/deduct', asyncHandler(adminController.deductCurrency));

// ============================================================
// MINING JOBS
// ============================================================
router.get('/mining-jobs', asyncHandler(adminController.listMiningJobs));
router.post('/mining-jobs/:id/retry', asyncHandler(adminController.retryMiningJob));
router.post('/mining-jobs/:id/pause', asyncHandler(adminController.pauseMiningJob));
router.post('/mining-jobs/:id/resume', asyncHandler(adminController.resumeMiningJob));

// ============================================================
// SETTINGS
// ============================================================
router.patch('/settings', asyncHandler(adminController.updateSettings));

// ============================================================
// USERS
// ============================================================
router.get('/users', asyncHandler(adminController.listUsers));
router.get('/users/:id', asyncHandler(adminController.getUser));
router.patch('/users/:id', asyncHandler(adminController.updateUser));
router.post('/users/:id/block', asyncHandler(adminController.blockUser));
router.post('/users/:id/unblock', asyncHandler(adminController.unblockUser));
router.post('/users/:id/impersonate', asyncHandler(adminController.impersonateUser));

module.exports = router;
