/**
 * NEXO Landing Page Creator v3.0 - Admin Controller
 *
 * HTTP handlers for the administrative Command Center API.
 *
 * @module controllers/adminController
 * @version 3.0.0
 */

const adminService = require('../services/lpAdminService');
const adminEventBus = require('../services/adminEventBus');

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
  // ============================================================
  // DASHBOARD
  // ============================================================

  /**
   * GET /admin/stats
   */
  async getStats(req, res) {
    try {
      const stats = await adminService.getStats();
      return res.status(200).json(success(stats, 'Dashboard statistics retrieved'));
    } catch (error) {
      return handleControllerError(res, error);
    }
  },

  // ============================================================
  // TEMPLATES
  // ============================================================

  /**
   * GET /admin/templates
   */
  async listTemplates(req, res) {
    try {
      const { status, category, subcategory, stack, search, limit = '1000' } = req.query;
      const filters = {};
      if (status) filters.status = status;
      if (category) filters.category = category;
      if (subcategory) filters.subcategory = subcategory;
      if (stack) filters.stack = stack;
      if (search) filters.search = search;
      if (limit) filters.limit = parseInt(limit, 10) || 1000;

      const result = await adminService.listTemplates(filters);
      return res.status(200).json(success(result, 'Templates retrieved successfully'));
    } catch (error) {
      return handleControllerError(res, error);
    }
  },

  /**
   * PATCH /admin/templates/:id
   */
  async updateTemplate(req, res) {
    try {
      const { id } = req.params;
      const updated = await adminService.updateTemplate(id, req.body, req.userId);
      return res.status(200).json(success(updated, 'Template updated successfully'));
    } catch (error) {
      return handleControllerError(res, error);
    }
  },

  /**
   * POST /admin/templates/:id/approve
   */
  async approveTemplate(req, res) {
    try {
      const { id } = req.params;
      const result = await adminService.approveTemplate(id, req.userId);
      return res.status(200).json(success(result, 'Template approved successfully'));
    } catch (error) {
      return handleControllerError(res, error);
    }
  },

  /**
   * DELETE /admin/templates/:id
   */
  async deleteTemplate(req, res) {
    try {
      const { id } = req.params;
      const deleted = await adminService.deleteTemplate(id, req.userId);
      return res.status(200).json(success({ deleted }, 'Template deleted successfully'));
    } catch (error) {
      return handleControllerError(res, error);
    }
  },

  /**
   * POST /admin/templates/:id/sanitize
   */
  async sanitizeTemplate(req, res) {
    try {
      const { id } = req.params;
      const result = await adminService.sanitizeTemplate(id, req.userId);
      return res.status(200).json(success(result, 'Sanitization queued successfully'));
    } catch (error) {
      return handleControllerError(res, error);
    }
  },

  // ============================================================
  // SESSIONS
  // ============================================================

  /**
   * GET /admin/sessions
   */
  async listSessions(req, res) {
    try {
      const { status, search, limit = '1000' } = req.query;
      const filters = {};
      if (status) filters.status = status;
      if (search) filters.search = search;
      if (limit) filters.limit = parseInt(limit, 10) || 1000;

      const result = await adminService.listSessions(filters);
      return res.status(200).json(success(result, 'Sessions retrieved successfully'));
    } catch (error) {
      return handleControllerError(res, error);
    }
  },

  /**
   * POST /admin/sessions/:id/regenerate
   */
  async regenerateSession(req, res) {
    try {
      const { id } = req.params;
      const result = await adminService.regenerateSession(id, req.userId);
      return res.status(200).json(success(result, 'Session regeneration queued'));
    } catch (error) {
      return handleControllerError(res, error);
    }
  },

  /**
   * DELETE /admin/sessions/:id
   */
  async deleteSession(req, res) {
    try {
      const { id } = req.params;
      const deleted = await adminService.deleteSession(id, req.userId);
      return res.status(200).json(success({ deleted }, 'Session deleted successfully'));
    } catch (error) {
      return handleControllerError(res, error);
    }
  },

  // ============================================================
  // PURCHASES
  // ============================================================

  /**
   * GET /admin/purchases
   */
  async listPurchases(req, res) {
    try {
      const { userId, templateId, limit = '1000' } = req.query;
      const filters = {};
      if (userId) filters.userId = userId;
      if (templateId) filters.templateId = templateId;
      if (limit) filters.limit = parseInt(limit, 10) || 1000;

      const result = await adminService.listPurchases(filters);
      return res.status(200).json(success(result, 'Purchases retrieved successfully'));
    } catch (error) {
      return handleControllerError(res, error);
    }
  },

  // ============================================================
  // CURRENCY
  // ============================================================

  /**
   * POST /admin/currency/credit
   */
  async creditCurrency(req, res) {
    try {
      const { userId, currency, amount } = req.body;
      const result = await adminService.creditCurrency(userId, currency, amount, req.userId);
      return res.status(200).json(success(result, 'Currency credited successfully'));
    } catch (error) {
      return handleControllerError(res, error, error.message.includes('Invalid') ? 400 : 500);
    }
  },

  /**
   * POST /admin/currency/deduct
   */
  async deductCurrency(req, res) {
    try {
      const { userId, currency, amount } = req.body;
      const result = await adminService.deductCurrency(userId, currency, amount, req.userId);
      return res.status(200).json(success(result, 'Currency deducted successfully'));
    } catch (error) {
      return handleControllerError(res, error, error.message.includes('Invalid') ? 400 : 500);
    }
  },

  // ============================================================
  // MINING JOBS
  // ============================================================

  /**
   * GET /admin/mining-jobs
   */
  async listMiningJobs(req, res) {
    try {
      const { status, limit = '1000' } = req.query;
      const filters = {};
      if (status) filters.status = status;
      if (limit) filters.limit = parseInt(limit, 10) || 1000;

      const result = await adminService.listMiningJobs(filters);
      return res.status(200).json(success(result, 'Mining jobs retrieved successfully'));
    } catch (error) {
      return handleControllerError(res, error);
    }
  },

  /**
   * POST /admin/mining-jobs/:id/retry
   */
  async retryMiningJob(req, res) {
    try {
      const { id } = req.params;
      const result = await adminService.retryMiningJob(id, req.userId);
      return res.status(200).json(success(result, 'Mining job retried successfully'));
    } catch (error) {
      return handleControllerError(res, error);
    }
  },

  /**
   * POST /admin/mining-jobs/:id/pause
   */
  async pauseMiningJob(req, res) {
    try {
      const { id } = req.params;
      const result = await adminService.pauseMiningJob(id, req.userId);
      return res.status(200).json(success(result, 'Mining job paused successfully'));
    } catch (error) {
      return handleControllerError(res, error);
    }
  },

  /**
   * POST /admin/mining-jobs/:id/resume
   */
  async resumeMiningJob(req, res) {
    try {
      const { id } = req.params;
      const result = await adminService.resumeMiningJob(id, req.userId);
      return res.status(200).json(success(result, 'Mining job resumed successfully'));
    } catch (error) {
      return handleControllerError(res, error);
    }
  },

  // ============================================================
  // SETTINGS
  // ============================================================

  /**
   * GET /admin/settings
   */
  async getSettings(req, res) {
    try {
      const result = await adminService.getSettings();
      return res.status(200).json(success(result, 'Settings retrieved successfully'));
    } catch (error) {
      return handleControllerError(res, error);
    }
  },

  /**
   * PATCH /admin/settings
   */
  async updateSettings(req, res) {
    try {
      const result = await adminService.updateSettings(req.body, req.userId);
      return res.status(200).json(success(result, 'Settings updated successfully'));
    } catch (error) {
      return handleControllerError(res, error, error.message.includes('must be') ? 400 : 500);
    }
  },

  // ============================================================
  // USERS
  // ============================================================

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

      const result = await adminService.listUsers(options, pageNum, limitNum, req.userId);
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
      const user = await adminService.getUser(id, req.userId);

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

  /**
   * GET /admin/events
   * Server-Sent Events stream for admin live operations.
   */
  streamAdminEvents(req, res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Flush headers immediately so the client fires onopen / connects.
    res.write(':connected\n\n');

    // Send buffered events first
    adminEventBus.getRecent().forEach((event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    const listener = (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    adminEventBus.on('event', listener);

    const heartbeat = setInterval(() => {
      res.write('event: heartbeat\ndata: {}\n\n');
    }, 30000);

    req.on('close', () => {
      clearInterval(heartbeat);
      adminEventBus.off('event', listener);
    });
  },
};

module.exports = adminController;
