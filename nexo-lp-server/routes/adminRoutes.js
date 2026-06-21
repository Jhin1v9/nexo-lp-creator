/**
 * NEXO Landing Page Creator v3.0 - Admin Routes
 *
 * Administrative API endpoints for user management.
 *
 * @module routes/adminRoutes
 * @version 3.0.0
 */

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

/**
 * Helper: Async handler wrapper to catch errors in async route handlers
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

router.get('/users', asyncHandler(adminController.listUsers));
router.get('/users/:id', asyncHandler(adminController.getUser));
router.patch('/users/:id', asyncHandler(adminController.updateUser));
router.post('/users/:id/block', asyncHandler(adminController.blockUser));
router.post('/users/:id/unblock', asyncHandler(adminController.unblockUser));
router.post('/users/:id/impersonate', asyncHandler(adminController.impersonateUser));

module.exports = router;
