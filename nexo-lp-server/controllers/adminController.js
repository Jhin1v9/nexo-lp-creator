/**
 * NEXO Landing Page Creator v3.0 - Admin Controller
 *
 * HTTP handlers for the administrative user management API.
 *
 * @module controllers/adminController
 * @version 3.0.0
 */

const adminService = require('../services/lpAdminService');

/**
 * Helper: Standard success response formatter
 */
const success = (data, message = 'Success') => ({
  success: true,
  message,
  data,
  timestamp: new Date().toISOString(),
});

/**
 * Helper: Standard controller error handler
 */
const handleControllerError = (res, error, statusCode = 500) => {
  console.error('[AdminController] Error:', error.message);
  res.status(statusCode).json({
    success: false,
    error: {
      message: error.message || 'Internal server error',
      code: error.code || 'INTERNAL_ERROR',
    },
    timestamp: new Date().toISOString(),
  });
};

const adminController = {
  /**
   * GET /admin/users
   */
  async listUsers(req, res) {
    try {
      const { status, role, search, page = '1', limit = '20' } = req.query;
      const options = {};
      if (status) options.status = status;
      if (role) options.role = role;
      if (search) options.search = search;

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

      const result = await adminService.listUsers(options, pageNum, limitNum);
      return res.status(200).json(success(result, 'Users retrieved successfully'));
    } catch (error) {
      return handleControllerError(res, error);
    }
  },

  /**
   * GET /admin/users/:id
   */
  async getUser(req, res) {
    try {
      const { id } = req.params;
      const user = await adminService.getUser(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: { message: 'User not found', code: 'NOT_FOUND' },
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(200).json(success(user, 'User retrieved successfully'));
    } catch (error) {
      return handleControllerError(res, error);
    }
  },

  /**
   * PATCH /admin/users/:id
   */
  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const user = await adminService.updateUser(id, req.body, req.userId);
      return res.status(200).json(success(user, 'User updated successfully'));
    } catch (error) {
      return handleControllerError(res, error);
    }
  },

  /**
   * POST /admin/users/:id/block
   */
  async blockUser(req, res) {
    try {
      const { id } = req.params;
      const user = await adminService.blockUser(id, req.userId);
      return res.status(200).json(success(user, 'User blocked successfully'));
    } catch (error) {
      return handleControllerError(res, error);
    }
  },

  /**
   * POST /admin/users/:id/unblock
   */
  async unblockUser(req, res) {
    try {
      const { id } = req.params;
      const user = await adminService.unblockUser(id, req.userId);
      return res.status(200).json(success(user, 'User unblocked successfully'));
    } catch (error) {
      return handleControllerError(res, error);
    }
  },

  /**
   * POST /admin/users/:id/impersonate
   */
  async impersonateUser(req, res) {
    try {
      const { id } = req.params;
      const result = await adminService.impersonateUser(id, req.userId);
      return res.status(200).json(success(result, 'Impersonation token generated'));
    } catch (error) {
      return handleControllerError(res, error);
    }
  },
};

module.exports = adminController;
