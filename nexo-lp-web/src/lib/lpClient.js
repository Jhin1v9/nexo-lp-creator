/**
 * Landing Page Client - Handles all LP operations
 */
import * as api from '../api.js';
import { generationEvents } from '../stores.js';

export class LPClient {
  constructor() {
    this.sessionId = null;
    this.userId = null;
    this.projectName = 'Untitled Project';
    this.messageHistory = [];
    this.currentHtml = '';
    this.isInitialized = false;
    this.kimiChatUrl = null;
    this.contextWarning = 'none';
    this.contextSize = 0;
    this.contextLimit = 0;
    this.mode = 'stars';
    this.generationMode = 'Landing';
  }

  setMode(mode) {
    this.mode = mode || 'stars';
  }

  setGenerationMode(mode) {
    this.generationMode = mode || 'Landing';
  }

  _setContextFromResponse(response) {
    if (!response) return;
    if (response.kimiChatUrl !== undefined) this.kimiChatUrl = response.kimiChatUrl;
    if (response.contextWarning !== undefined) this.contextWarning = response.contextWarning;
    if (response.contextSize !== undefined) this.contextSize = response.contextSize;
    if (response.contextLimit !== undefined) this.contextLimit = response.contextLimit;
    if (response.userId !== undefined) this.userId = response.userId;
    if (response.user_id !== undefined) this.userId = response.user_id;
  }

  /**
   * Initialize a new session
   */
  async init(projectName) {
    this.projectName = projectName || 'Untitled Project';
    const response = await api.createSession(this.projectName);
    this.sessionId = response.sessionId;
    this.isInitialized = true;
    this.messageHistory = [];
    this.currentHtml = '';
    this._setContextFromResponse(response);
    return response;
  }

  /**
   * List recent sessions
   */
  async listSessions(page = 1, limit = 50) {
    return api.listSessions(page, limit);
  }

  /**
   * Set existing session and load persisted messages
   */
  async setSession(sessionId, projectName) {
    this.sessionId = sessionId;
    this.projectName = projectName || 'Untitled Project';
    this.isInitialized = true;
    try {
      const sessionData = await api.getSession(sessionId);
      this._setContextFromResponse(sessionData);
    } catch (error) {
      console.error('Failed to load session details:', error);
    }
    try {
      const messages = await api.getMessages(sessionId);
      this.messageHistory = messages.map((m) => ({
        role: m.role,
        content: m.content,
        type: m.type || 'text',
        metadata: m.metadata || {},
        timestamp: m.createdAt ? new Date(m.createdAt).getTime() : Date.now(),
      }));
    } catch (error) {
      console.error('Failed to load messages:', error);
      this.messageHistory = [];
    }
  }

  /**
   * Send a chat message and stream progress via callback
   */
  async sendMessage(message, streamCallback = null) {
    if (!this.isInitialized) {
      await this.init();
    }

    this.messageHistory.push({ role: 'user', content: message });

    // Persist user message
    if (this.sessionId) {
      api.addMessage(this.sessionId, { role: 'user', content: message, type: 'text' }).catch((err) => {
        console.error('Failed to persist user message:', err);
      });
    }

    if (!streamCallback) {
      const response = await api.generate(this.sessionId, message, { mode: this.mode, generationMode: this.generationMode });
      this._setContextFromResponse(response);
      const preview = await this._pollPreview();
      this.currentHtml = preview?.html || this.currentHtml;
      return { content: 'Generation complete', html: this.currentHtml };
    }

    // Start generation in background ONCE, then listen to SSE for real-time progress.
    generationEvents.set([]);

    return new Promise((resolve, reject) => {

      // Connect to SSE first so we don't miss early action_start events.
      const eventSource = api.sendMessage(this.sessionId, message, true);
      let completed = false;

      // Small grace period to ensure SSE is registered before kicking off generation
      setTimeout(() => {
        api.generate(this.sessionId, message, { mode: this.mode, generationMode: this.generationMode }).catch((err) => {
          console.error('[LPClient] Background generation failed:', err);
          streamCallback({ type: 'error', error: err.message });
        });
      }, 100);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'action_start') {
            const event = {
              id: `${data.phase}-${Date.now()}`,
              type: data.phase,
              name: data.phase,
              phase: data.phase,
              message: data.message || `${data.phase} started`,
              description: data.message || `${data.phase} started`,
              status: 'loading',
              result: data.result || null,
              timestamp: Date.now(),
            };
            generationEvents.update((events) => [...events, event]);
            streamCallback({
              type: 'tool_start',
              phase: data.phase,
              message: data.message || `${data.phase} started`,
            });
          } else if (data.type === 'action_end') {
            generationEvents.update((events) =>
              events.map((e) =>
                e.phase === data.phase && e.status === 'loading'
                  ? { ...e, status: 'success', message: data.message || `${data.phase} ended`, result: data.result || e.result }
                  : e
              )
            );
            streamCallback({
              type: 'tool_end',
              phase: data.phase,
              message: data.message || `${data.phase} ended`,
              completed: data.completed,
            });
            if (data.phase === 'generation' && data.completed) {
              completed = true;
              eventSource.close();
              this._finalize(streamCallback).then(resolve).catch(reject);
            }
          } else if (data.type === 'thinking_start') {
            generationEvents.update((events) => {
              // Mark any previous thinking event as done before starting a new one
              const cleaned = events.map((e) =>
                e.phase === 'thinking' && e.status === 'loading' ? { ...e, status: 'success' } : e
              );
              return [
                ...cleaned,
                {
                  id: `thinking-${Date.now()}`,
                  type: 'thinking',
                  name: 'thinking',
                  phase: 'thinking',
                  message: data.message || 'Pensando...',
                  description: data.message || 'Pensando...',
                  status: 'loading',
                  result: null,
                  timestamp: Date.now(),
                },
              ];
            });
            streamCallback({ type: 'thinking', status: 'start' });
          } else if (data.type === 'thinking_delta') {
            generationEvents.update((events) =>
              events.map((e) =>
                e.phase === 'thinking' && e.status === 'loading'
                  ? { ...e, message: 'Pensando...', description: data.text || 'Pensando...' }
                  : e
              )
            );
            streamCallback({ type: 'thinking', status: 'delta', content: data.text || '' });
          } else if (data.type === 'response_delta') {
            generationEvents.update((events) =>
              events.map((e) =>
                e.phase === 'thinking' && e.status === 'loading' ? { ...e, status: 'success', message: 'Pensamento finalizado' } : e
              )
            );
            streamCallback({ type: 'response', content: data.text || '' });
          } else if (data.type === 'action_continue') {
            generationEvents.update((events) =>
              events.map((e) =>
                e.phase === data.phase && e.status === 'loading'
                  ? { ...e, message: data.message || `${data.phase} continuing...`, attempt: data.attempt }
                  : e
              )
            );
          } else if (data.type === 'action_error') {
            generationEvents.update((events) =>
              events.map((e) =>
                e.phase === data.phase && e.status === 'loading'
                  ? { ...e, status: 'error', message: data.message || data.error || `${data.phase} failed` }
                  : e
              )
            );
          } else if (data.type === 'action_detected') {
            streamCallback({ type: 'tool_action', action: data.action });
          }
        } catch (error) {
          // Non-JSON message, ignore
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        if (!completed) {
          // SSE closed before completion; fall back to polling preview
          this._finalize(streamCallback).then(resolve).catch(reject);
        }
      };

      // Safety timeout (5 minutes to accommodate real Kimi generation)
      setTimeout(() => {
        if (!completed) {
          eventSource.close();
          this._finalize(streamCallback).then(resolve).catch(reject);
        }
      }, 300000);
    });
  }

  async _finalize(streamCallback) {
    try {
      const preview = await this._pollPreview();
      this.currentHtml = preview?.html || this.currentHtml;

      const content = "I've worked on your request! Check the Preview tab to see the result.";
      const assistantMessage = {
        role: 'assistant',
        content,
        type: 'text',
        metadata: { previewUrl: preview?.previewUrl },
      };
      // Keep the message locally for the current session; the backend already
      // persists the official completion message when generation finishes.
      this.messageHistory.push(assistantMessage);

      streamCallback({ type: 'complete', html: this.currentHtml, content });
      return { content, html: this.currentHtml };
    } catch (error) {
      streamCallback({ type: 'complete', html: this.currentHtml, error: error.message });
      throw error;
    }
  }

  async _pollPreview(maxAttempts = 300, interval = 1000) {
    // Poll for up to 5 minutes to accommodate real Kimi generation. Use the
    // persisted preview file as the source of truth instead of the session row
    // so the frontend always reflects the latest saved HTML, even if the
    // session.current_html update lags or fails.
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const session = await api.getSession(this.sessionId);
        this._setContextFromResponse(session);
      } catch (error) {
        // Ignore session polling errors; context info is best-effort here.
      }

      try {
        const preview = await api.getPreview(this.sessionId);
        if (preview?.html) {
          return {
            html: preview.html,
            previewUrl: preview.previewUrl || null,
          };
        }
      } catch (error) {
        // Preview not saved yet — keep polling.
      }

      await new Promise((r) => setTimeout(r, interval));
    }
    return null;
  }

  /**
   * Generate from a prompt
   */
  async generate(prompt, options = {}) {
    if (!this.isInitialized) {
      await this.init();
    }

    const response = await api.generate(this.sessionId, prompt, {
      mode: this.mode,
      generationMode: this.generationMode,
      ...options,
    });
    this._setContextFromResponse(response);
    const preview = await this._pollPreview();
    if (preview?.html) {
      this.currentHtml = preview.html;
    }
    return { ...response, html: this.currentHtml };
  }

  /**
   * Get current preview HTML
   */
  async getPreview() {
    if (!this.sessionId) return null;
    return api.getPreview(this.sessionId);
  }

  /**
   * Save preview HTML
   */
  async savePreview(html) {
    if (!this.sessionId) return null;
    this.currentHtml = html;
    return api.savePreview(this.sessionId, html);
  }

  /**
   * Detect bugs/issues in HTML
   */
  async detectBugs(html = null) {
    if (!this.sessionId) return null;
    const htmlToCheck = html || this.currentHtml;
    return api.detectBugs(this.sessionId, htmlToCheck);
  }

  /**
   * Deploy the landing page
   */
  async deploy(platform, config = {}) {
    if (!this.sessionId) return null;
    return api.deploy(this.sessionId, platform, config);
  }

  /**
   * Get deploy status
   */
  async getDeployStatus(deployId) {
    return api.getDeployStatus(deployId);
  }

  /**
   * Save a version
   */
  async saveVersion(html, note = '') {
    if (!this.sessionId) return null;
    return api.saveVersion(this.sessionId, html || this.currentHtml, note);
  }

  /**
   * Get version history
   */
  async getVersions() {
    if (!this.sessionId) return [];
    return api.getVersions(this.sessionId);
  }

  /**
   * Rollback to a version
   */
  async rollbackVersion(versionId) {
    if (!this.sessionId) return null;
    const response = await api.rollbackVersion(this.sessionId, versionId);
    if (response.html) {
      this.currentHtml = response.html;
    }
    return response;
  }

  /**
   * Get token balance
   */
  async getTokenBalance() {
    return api.getTokenBalance();
  }

  /**
   * Get templates
   */
  async getTemplates(filters = {}) {
    return api.getTemplates(filters);
  }

  /**
   * Use a template
   */
  async useTemplate(templateId) {
    if (!this.sessionId) {
      await this.init();
    }
    const response = await api.useTemplate(this.sessionId, templateId, this.userId);
    if (response.html) {
      this.currentHtml = response.html;
    }
    return response;
  }

  /**
   * Buy a template
   */
  async buyTemplate(templateId) {
    return api.buyTemplate(templateId, this.userId);
  }

  /**
   * Get template prompt (locked or unlocked)
   */
  async getTemplatePrompt(templateId) {
    return api.getTemplatePrompt(templateId, this.userId);
  }

  /**
   * Get current HTML
   */
  getHtml() {
    return this.currentHtml;
  }

  /**
   * Fetch current HTML from the server (source of truth)
   */
  async fetchHtml() {
    if (!this.sessionId) return null;
    try {
      // Prefer the persisted preview file as the source of truth.
      const preview = await api.getPreview(this.sessionId);
      if (preview?.html) {
        this.currentHtml = preview.html;
        return preview.html;
      }
    } catch (error) {
      console.error("[LPClient] fetchHtml failed:", error);
    }
    return this.currentHtml || null;
  }

  /**
   * Get Kimi chat URL
   */
  getKimiChatUrl() {
    return this.kimiChatUrl;
  }

  /**
   * Get context warning level
   */
  getContextWarning() {
    return this.contextWarning;
  }

  /**
   * Get context usage info
   */
  getContextInfo() {
    return { size: this.contextSize, limit: this.contextLimit };
  }

  /**
   * Reset client state for a new project
   */
  reset() {
    this.sessionId = null;
    this.projectName = 'Untitled Project';
    this.messageHistory = [];
    this.currentHtml = '';
    this.isInitialized = false;
    this.kimiChatUrl = null;
    this.contextWarning = 'none';
    this.contextSize = 0;
    this.contextLimit = 0;
  }

  /**
   * Check if initialized
   */
  get isReady() {
    return this.isInitialized && this.sessionId !== null;
  }
}

export const lpClient = new LPClient();
