/**
 * NEXO Landing Page Creator v3.0 - Preview Service
 *
 * Manages generated HTML previews for landing pages.
 * Stores HTML files and serves them for preview.
 *
 * @module services/lpPreviewService
 * @version 3.0.0
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const SessionRepository = require('../models/repositories/SessionRepository');
const config = require('../config/nexo-lp-config');

/**
 * Sanitize a session id before using it in file paths.
 * Allows alphanumeric, dash and underscore only.
 */
function sanitizeSessionId(sessionId) {
  if (!sessionId || typeof sessionId !== 'string') {
    throw new Error('sessionId is required');
  }
  const safe = sessionId.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safe || safe.length > 128) {
    throw new Error('Invalid session id');
  }
  return safe;
}

class PreviewService {
  constructor() {
    this.storagePath = config.preview.storagePath;
    this.baseUrl = config.preview.baseUrl;
    this.ensureStoragePath();
  }

  /**
   * Ensure the preview storage directory exists
   */
  ensureStoragePath() {
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
  }

  /**
   * Get the file path for a session's preview HTML
   * @param {string} sessionId
   * @returns {string}
   */
  getPreviewFilePath(sessionId) {
    return path.join(this.storagePath, `${sanitizeSessionId(sessionId)}.html`);
  }

  /**
   * Get the file path for a session's preview assets directory
   * @param {string} sessionId
   * @returns {string}
   */
  getPreviewAssetsPath(sessionId) {
    return path.join(this.storagePath, `${sanitizeSessionId(sessionId)}-assets`);
  }

  /**
   * Save generated HTML for preview
   * @param {string} sessionId
   * @param {string} html
   * @param {object} assets - Optional { css, js } strings
   * @returns {object} Preview info
   */
  async savePreview(sessionId, html, assets = {}) {
    const safeId = sanitizeSessionId(sessionId);
    if (!html) {
      throw new Error('html is required');
    }

    this.ensureStoragePath();

    // Wrap raw HTML in a complete document if needed
    const fullHtml = this.wrapHtml(html, assets);

    // Save the HTML file
    const filePath = this.getPreviewFilePath(sessionId);
    fs.writeFileSync(filePath, fullHtml, 'utf-8');

    // Save CSS if provided
    if (assets.css) {
      const assetsPath = this.getPreviewAssetsPath(sessionId);
      if (!fs.existsSync(assetsPath)) {
        fs.mkdirSync(assetsPath, { recursive: true });
      }
      fs.writeFileSync(path.join(assetsPath, 'styles.css'), assets.css, 'utf-8');
    }

    // Save JS if provided
    if (assets.js) {
      const assetsPath = this.getPreviewAssetsPath(sessionId);
      if (!fs.existsSync(assetsPath)) {
        fs.mkdirSync(assetsPath, { recursive: true });
      }
      fs.writeFileSync(path.join(assetsPath, 'script.js'), assets.js, 'utf-8');
    }

    // Update session with preview URL
    const previewUrl = `${this.baseUrl}/preview/${sessionId}.html`;
    await SessionRepository.updatePreviewUrl(sessionId, previewUrl);

    return {
      sessionId,
      previewUrl,
      filePath,
      savedAt: new Date().toISOString(),
    };
  }

  /**
   * Get preview for a session
   * @param {string} sessionId
   * @returns {object|null} Preview data or null if not found
   */
  async getPreview(sessionId) {
    const filePath = this.getPreviewFilePath(sessionId);

    if (!fs.existsSync(filePath)) {
      // Check if session has HTML stored in database
      const session = await SessionRepository.findById(sessionId);
      if (session && session.current_html) {
        // Save it to file and return
        const assets = {
          css: session.generated_css || '',
          js: session.generated_js || '',
        };
        return this.savePreview(sessionId, session.current_html, assets);
      }
      return null;
    }

    const html = fs.readFileSync(filePath, 'utf-8');
    const stats = fs.statSync(filePath);

    return {
      sessionId,
      html,
      previewUrl: `${this.baseUrl}/preview/${sessionId}.html`,
      fileSize: stats.size,
      lastModified: stats.mtime.toISOString(),
    };
  }

  /**
   * Check if a preview exists
   * @param {string} sessionId
   * @returns {boolean}
   */
  async previewExists(sessionId) {
    const filePath = this.getPreviewFilePath(sessionId);
    return fs.existsSync(filePath);
  }

  /**
   * Delete a preview
   * @param {string} sessionId
   * @returns {boolean}
   */
  async deletePreview(sessionId) {
    const filePath = this.getPreviewFilePath(sessionId);
    const assetsPath = this.getPreviewAssetsPath(sessionId);
    let deleted = false;

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      deleted = true;
    }

    if (fs.existsSync(assetsPath)) {
      fs.rmSync(assetsPath, { recursive: true, force: true });
    }

    return deleted;
  }

  /**
   * Wrap raw HTML body in a complete HTML document
   * @param {string} html - Raw HTML content
   * @param {object} assets - { css, js }
   * @returns {string} Complete HTML document
   */
  wrapHtml(html, assets = {}) {
    // If already a full HTML document, return as-is
    if (html.trim().toLowerCase().startsWith('<!doctype') || html.trim().toLowerCase().startsWith('<html')) {
      return html;
    }

    const cssBlock = assets.css ? `<style>\n${assets.css}\n</style>` : '';
    const jsBlock = assets.js ? `<script>\n${assets.js}\n</script>` : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NEXO Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', sans-serif; }
    ${assets.css ? '' : '/* No custom CSS */'}
  </style>
  ${cssBlock}
</head>
<body>
${html}
${jsBlock}
</body>
</html>`;
  }

  /**
   * Get preview file statistics
   * @param {string} sessionId
   * @returns {object|null}
   */
  async getPreviewStats(sessionId) {
    const filePath = this.getPreviewFilePath(sessionId);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    const stats = fs.statSync(filePath);
    const html = fs.readFileSync(filePath, 'utf-8');

    return {
      sessionId,
      fileSize: stats.size,
      lineCount: html.split('\n').length,
      lastModified: stats.mtime.toISOString(),
      createdAt: stats.birthtime.toISOString(),
      previewUrl: `${this.baseUrl}/preview/${sessionId}.html`,
    };
  }

  /**
   * Clean up old previews (files older than TTL)
   * @returns {number} Number of files deleted
   */
  async cleanupOldPreviews() {
    const ttlMs = config.preview.ttlMs;
    const now = Date.now();
    let deleted = 0;

    if (!fs.existsSync(this.storagePath)) {
      return 0;
    }

    const files = fs.readdirSync(this.storagePath);

    for (const file of files) {
      const filePath = path.join(this.storagePath, file);
      const stats = fs.statSync(filePath);
      const age = now - stats.mtime.getTime();

      if (age > ttlMs) {
        if (stats.isDirectory()) {
          fs.rmSync(filePath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(filePath);
        }
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Get the public previews directory path
   * @returns {string}
   */
  getPublicStoragePath() {
    return path.join(this.storagePath, 'public');
  }

  /**
   * Ensure the public preview storage directory exists
   */
  ensurePublicStoragePath() {
    const publicPath = this.getPublicStoragePath();
    if (!fs.existsSync(publicPath)) {
      fs.mkdirSync(publicPath, { recursive: true });
    }
  }

  /**
   * Generate a unique public preview token
   * @returns {string}
   */
  generatePublicToken() {
    return `pub-${crypto.randomUUID()}`;
  }

  /**
   * Publish a public preview HTML file
   * @param {string} sessionId
   * @param {string} html
   * @param {string} token - Optional public token (generated if omitted)
   * @returns {object} Public preview info
   */
  async publishPublicPreview(sessionId, html, token = null) {
    if (!html) {
      throw new Error('html is required');
    }

    const publicToken = token || this.generatePublicToken();
    this.ensurePublicStoragePath();

    const filePath = this.getPublicPreviewPath(publicToken);
    fs.writeFileSync(filePath, this.wrapHtml(html), 'utf-8');

    return {
      token: publicToken,
      url: this.getPublicPreviewUrl(publicToken),
    };
  }

  /**
   * Update an existing public preview HTML file
   * @param {string} token
   * @param {string} html
   * @returns {object} Public preview info
   */
  async updatePublicPreview(token, html) {
    if (!token) {
      throw new Error('token is required');
    }
    if (!html) {
      throw new Error('html is required');
    }

    const filePath = this.getPublicPreviewPath(token);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Public preview not found: ${token}`);
    }

    fs.writeFileSync(filePath, this.wrapHtml(html), 'utf-8');

    return {
      token,
      url: this.getPublicPreviewUrl(token),
    };
  }

  /**
   * Get the absolute file path for a public preview token
   * @param {string} token
   * @returns {string}
   */
  getPublicPreviewPath(token) {
    return path.join(this.getPublicStoragePath(), `${token}.html`);
  }

  /**
   * Get the public URL path for a public preview token
   * @param {string} token
   * @returns {string}
   */
  getPublicPreviewUrl(token) {
    return `/preview/public/${token}.html`;
  }
}

module.exports = new PreviewService();
