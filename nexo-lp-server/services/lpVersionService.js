/**
 * NEXO Landing Page Creator v3.0 - Version Service
 *
 * Manages version history for landing page sessions.
 */

const VersionRepository = require('../models/repositories/VersionRepository');
const SessionRepository = require('../models/repositories/SessionRepository');

class VersionService {
  /**
   * Save a new version for a session.
   */
  async saveVersion(sessionId, { html, css, js, note, metadata }) {
    const session = await SessionRepository.findById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const version = await VersionRepository.create({
      sessionId,
      html,
      css,
      js,
      changeSummary: note || `Version saved`,
      metadata,
    });

    return version;
  }

  /**
   * List versions for a session, newest first.
   */
  async listVersions(sessionId, options = {}) {
    const session = await SessionRepository.findById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    return VersionRepository.findBySessionId(sessionId, options);
  }

  /**
   * Roll back a session to a specific version.
   */
  async rollbackVersion(sessionId, versionId) {
    const session = await SessionRepository.findById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    return VersionRepository.rollback(sessionId, versionId);
  }

  /**
   * Delete a version.
   */
  async deleteVersion(sessionId, versionId) {
    const version = await VersionRepository.findById(versionId);
    if (!version) {
      throw new Error('Version not found');
    }
    if (version.session_id !== sessionId) {
      throw new Error('Version does not belong to session');
    }
    return VersionRepository.delete(versionId);
  }

  /**
   * Auto-save a snapshot after generation/rebuild.
   * Uses the session's current html and a generated note.
   */
  async snapshot(sessionId, source = 'generation') {
    const session = await SessionRepository.findById(sessionId);
    if (!session || !session.current_html) {
      return null;
    }

    // Avoid duplicating the exact same HTML as the latest version
    const latest = await VersionRepository.findLatest(sessionId);
    if (latest && latest.html === session.current_html) {
      return latest;
    }

    return VersionRepository.create({
      sessionId,
      html: session.current_html,
      css: session.generated_css || '',
      js: session.generated_js || '',
      changeSummary: `Saved after ${source}`,
      metadata: { source, stack: session.stack },
    });
  }
}

module.exports = new VersionService();
