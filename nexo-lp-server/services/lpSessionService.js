/**
 * NEXO Landing Page Creator v3.0 - Session Service
 * Async session CRUD and lifecycle management.
 */

const SessionRepository = require('../models/repositories/SessionRepository');
const MessageRepository = require('../models/repositories/MessageRepository');

class SessionService {
  constructor() {
    this.repository = SessionRepository;
  }

  async createSession(data) {
    if (!data.userId) {
      throw new Error('userId is required to create a session');
    }

    const session = await this.repository.create({
      userId: data.userId,
      initialPrompt: data.initialPrompt || '',
      stack: data.stack || 'static-html-tailwind',
      status: data.status || 'created',
    });

    return session;
  }

  async getSessionById(id) {
    if (!id) throw new Error('Session ID is required');
    return this.repository.findById(id);
  }

  async getUserSessions(userId, options = {}) {
    return this.repository.findByUserId(userId, options);
  }

  async getSessionsByStatus(status, options = {}) {
    return this.repository.findByStatus(status, options);
  }

  async updateStatus(id, status) {
    const validStatuses = ['created', 'intention', 'structure', 'code', 'review', 'preview', 'deployed', 'failed', 'archived'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}`);
    }
    return this.repository.updateStatus(id, status);
  }

  async updateGeneratedCode(id, code) {
    if (!code || (!code.html && !code.css && !code.js)) {
      throw new Error('At least one of html, css, or js must be provided');
    }

    const session = await this.getSessionById(id);
    if (session && ['created', 'intention', 'structure'].includes(session.status)) {
      await this.repository.updateStatus(id, 'code');
    }

    return this.repository.updateGeneratedCode(id, code);
  }

  async updatePreviewUrl(id, previewUrl) {
    return this.repository.updatePreviewUrl(id, previewUrl);
  }

  async updateDeployUrl(id, deployUrl) {
    return this.repository.updateDeployUrl(id, deployUrl);
  }

  async updateMetadata(id, metadata) {
    if (!metadata || typeof metadata !== 'object') {
      throw new Error('Metadata must be a valid object');
    }
    return this.repository.updateMetadata(id, metadata);
  }

  async incrementVersion(id) {
    return this.repository.incrementVersion(id);
  }

  async renameSession(id, title) {
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      throw new Error('Valid title is required');
    }
    return this.repository.update(id, { initial_prompt: title.trim() });
  }

  async deleteSession(id) {
    return this.repository.delete(id);
  }

  async listSessions(filters = {}, page = 1, limit = 20) {
    return this.repository.list(filters, page, limit);
  }

  async getTotalCount() {
    return this.repository.count();
  }

  async sessionExists(id) {
    const session = await this.getSessionById(id);
    return session !== null;
  }

  /**
   * Calculate context usage for a session based on current HTML,
   * persisted chat messages, and metadata values.
   * @param {object} session - Session row from the repository
   * @returns {Promise<{kimiChatUrl: string|null, contextWarning: 'none'|'approaching'|'critical', contextSize: number, contextLimit: number}>}
   */
  async getContextInfo(session) {
    const contextLimit = 600000;

    if (!session) {
      return {
        kimiChatUrl: null,
        contextWarning: 'none',
        contextSize: 0,
        contextLimit,
      };
    }

    let metadata = {};
    try {
      metadata = session.metadata_json ? JSON.parse(session.metadata_json) : {};
    } catch {
      metadata = {};
    }

    let contextSize = 0;

    if (session.current_html) {
      contextSize += String(session.current_html).length;
    }

    const messages = await MessageRepository.findBySession(session.id);
    for (const message of messages) {
      if (message.content) {
        contextSize += String(message.content).length;
      }
    }

    contextSize += this._sumMetadataStringLengths(metadata);

    const ratio = contextSize / contextLimit;
    let contextWarning = 'none';
    if (ratio >= 0.9) {
      contextWarning = 'critical';
    } else if (ratio >= 0.7) {
      contextWarning = 'approaching';
    }

    return {
      kimiChatUrl: metadata.kimiChatUrl || null,
      contextWarning,
      contextSize,
      contextLimit,
    };
  }

  _sumMetadataStringLengths(value) {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'string') return value.length;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value).length;
    if (Array.isArray(value)) {
      return value.reduce((sum, item) => sum + this._sumMetadataStringLengths(item), 0);
    }
    if (typeof value === 'object') {
      return Object.values(value).reduce((sum, item) => sum + this._sumMetadataStringLengths(item), 0);
    }
    return 0;
  }

  async archiveOldSessions(olderThanDays = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    const result = await this.repository.updateWhere(
      { status: 'archived', updated_at: new Date().toISOString() },
      `created_at < ? AND status != 'archived'`,
      [cutoff.toISOString()]
    );
    return result;
  }

  // ============================================================
  // Chat messages persistence
  // ============================================================
  async addMessage(sessionId, { role, content, type = 'text', metadata = {} }) {
    if (!sessionId) throw new Error('Session ID is required');
    if (!role || !['user', 'assistant', 'system'].includes(role)) {
      throw new Error('Valid role is required');
    }
    return MessageRepository.create({ sessionId, role, content, type, metadata });
  }

  async getMessages(sessionId, options = {}) {
    if (!sessionId) throw new Error('Session ID is required');
    return MessageRepository.findBySession(sessionId, options);
  }

  async clearMessages(sessionId) {
    if (!sessionId) throw new Error('Session ID is required');
    return MessageRepository.deleteBySession(sessionId);
  }
}

module.exports = new SessionService();
