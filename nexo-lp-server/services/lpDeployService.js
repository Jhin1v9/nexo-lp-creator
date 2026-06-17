/**
 * NEXO Landing Page Creator v3.0 - Deploy Service
 *
 * Handles deployment of landing pages to GitHub Pages.
 * Falls back to ZIP file generation when GitHub deployment is unavailable.
 * Also supports copying code to clipboard.
 *
 * @module services/lpDeployService
 * @version 3.0.0
 */

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const SessionRepository = require('../models/repositories/SessionRepository');
const DeploymentRepository = require('../models/repositories/DeploymentRepository');
const config = require('../config/nexo-lp-config');

/**
 * Sanitize a session id before using it in file paths.
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

class DeployService {
  constructor() {
    this.github = config.github;
    this.previewStorage = config.preview.storagePath;
    this.dataPath = config.paths.data;
  }

  /**
   * Deploy landing page to GitHub Pages
   * @param {string} sessionId
   * @param {object} options - { repo, branch, message }
   * @returns {object} { success, url, branch, commit }
   */
  async deployToGitHub(sessionId, options = {}) {
    try {
      // Get session data
      const session = await SessionRepository.findById(sessionId);
      if (!session) {
        return { success: false, error: 'Session not found' };
      }

      // Check GitHub token
      if (!this.github.token) {
        return { success: false, error: 'GitHub token not configured' };
      }

      // Get HTML content
      const html = session.current_html;
      if (!html) {
        return { success: false, error: 'No generated HTML found for this session' };
      }

      // Create deployment record
      const deployment = await DeploymentRepository.create({
        session_id: sessionId,
        user_id: session.user_id,
        type: 'github',
        url: null,
        status: 'in_progress',
      });

      const repo = options.repo || this.github.repo;
      const owner = this.github.owner;
      const branch = options.branch || this.github.branch || 'gh-pages';
      const message = options.message || `Deploy landing page: ${sessionId}`;

      if (!repo || !owner) {
        await DeploymentRepository.updateStatus(deployment.id, 'failed');
        return { success: false, error: 'GitHub owner or repo not configured' };
      }

      // Use GitHub API to deploy
      const result = await this.pushToGitHub(html, {
        owner,
        repo,
        branch,
        message,
        path: `landing-pages/${sessionId}/index.html`,
      });

      if (result.success) {
        const deployUrl = result.url || `https://${owner}.github.io/${repo}/landing-pages/${sessionId}/`;

        // Update session with deploy URL
        await SessionRepository.updateDeployUrl(sessionId, deployUrl);

        // Update deployment record
        await DeploymentRepository.updateStatus(deployment.id, 'success', deployUrl);

        return {
          success: true,
          url: deployUrl,
          branch,
          commit: result.commit,
          deploymentId: deployment.id,
        };
      } else {
        await DeploymentRepository.updateStatus(deployment.id, 'failed');
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('[DeployService] GitHub deployment error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Push content to GitHub via API
   * @param {string} html
   * @param {object} params - { owner, repo, branch, message, path }
   * @returns {object}
   */
  async pushToGitHub(html, params) {
    try {
      const { owner, repo, branch, message, path: filePath } = params;

      // Get the current file SHA if it exists
      let currentSha = null;
      try {
        const getResponse = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`,
          {
            headers: {
              Authorization: `Bearer ${this.github.token}`,
              'User-Agent': 'NEXO-LP-Creator/3.0',
            },
          }
        );

        if (getResponse.ok) {
          const data = await getResponse.json();
          currentSha = data.sha;
        }
      } catch {
        // File doesn't exist yet, which is fine
      }

      // Create or update file
      const body = {
        message,
        content: Buffer.from(html).toString('base64'),
        branch,
        ...(currentSha && { sha: currentSha }),
      };

      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${this.github.token}`,
            'Content-Type': 'application/json',
            'User-Agent': 'NEXO-LP-Creator/3.0',
          },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: `GitHub API error: ${errorData.message || response.statusText}`,
        };
      }

      const data = await response.json();

      return {
        success: true,
        url: `https://${owner}.github.io/${repo}/${filePath.replace('index.html', '')}`,
        commit: data.commit?.sha,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Create a ZIP file for download (fallback deployment)
   * @param {string} sessionId
   * @returns {object} { success, downloadUrl, filename }
   */
  async createZip(sessionId) {
    try {
      const session = await SessionRepository.findById(sessionId);
      if (!session) {
        return { success: false, error: 'Session not found' };
      }

      const html = session.current_html;
      if (!html) {
        return { success: false, error: 'No generated HTML found for this session' };
      }

      // Create deployment record
      const deployment = await DeploymentRepository.create({
        session_id: sessionId,
        user_id: session.user_id,
        type: 'zip',
        url: null,
        status: 'in_progress',
      });

      // Ensure output directory exists
      const zipDir = path.join(this.dataPath, 'zips');
      if (!fs.existsSync(zipDir)) {
        fs.mkdirSync(zipDir, { recursive: true });
      }

      const safeId = sanitizeSessionId(sessionId);
      const filename = `nexo-lp-${safeId}.zip`;
      const zipPath = path.join(zipDir, filename);

      // Create ZIP archive
      await this.createZipArchive(zipPath, session);

      // Update deployment
      const downloadUrl = `/download/zips/${filename}`;
      await DeploymentRepository.updateStatus(deployment.id, 'success', downloadUrl);

      return {
        success: true,
        downloadUrl,
        filename,
        deploymentId: deployment.id,
      };
    } catch (error) {
      console.error('[DeployService] ZIP creation error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create ZIP archive with landing page files
   * @param {string} zipPath
   * @param {object} session
   * @returns {Promise<void>}
   */
  async createZipArchive(zipPath, session) {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve());
      archive.on('error', (err) => reject(err));
      archive.on('warning', (err) => {
        if (err.code === 'ENOENT') {
          console.warn('[DeployService] ZIP warning:', err.message);
        } else {
          reject(err);
        }
      });

      archive.pipe(output);

      // Add index.html
      archive.append(session.current_html || '', { name: 'index.html' });

      // Add CSS if exists
      if (session.generated_css) {
        archive.append(session.generated_css, { name: 'styles.css' });
      }

      // Add JS if exists
      if (session.generated_js) {
        archive.append(session.generated_js, { name: 'script.js' });
      }

      // Add README
      const readmeContent = `# Landing Page
Generated by NEXO Landing Page Creator v3.0
Session: ${session.id}
Created: ${session.created_at}

## Files
- index.html - Main landing page
${session.generated_css ? '- styles.css - Custom styles' : ''}
${session.generated_js ? '- script.js - JavaScript' : ''}

## Usage
Open index.html in a web browser or deploy to any static hosting service.
`;
      archive.append(readmeContent, { name: 'README.md' });

      archive.finalize();
    });
  }

  /**
   * Get the raw HTML code for copy functionality
   * @param {string} sessionId
   * @returns {object} { success, html }
   */
  async getCode(sessionId) {
    try {
      const session = await SessionRepository.findById(sessionId);
      if (!session) {
        return { success: false, error: 'Session not found' };
      }

      const html = session.current_html;
      if (!html) {
        return { success: false, error: 'No generated HTML found for this session' };
      }

      return {
        success: true,
        html,
        css: session.generated_css,
        js: session.generated_js,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get deployment history for a session
   * @param {string} sessionId
   * @returns {object[]}
   */
  async getDeploymentHistory(sessionId) {
    return DeploymentRepository.findBySession(sessionId);
  }

  /**
   * Get deployment status
   * @param {string} deploymentId
   * @returns {object|null}
   */
  async getDeploymentStatus(deploymentId) {
    return DeploymentRepository.findById(deploymentId);
  }
}

module.exports = new DeployService();
