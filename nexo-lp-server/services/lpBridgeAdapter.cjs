/**
 * NEXO Landing Page Creator v3.0 - Bridge Adapter
 *
 * Adapter pattern that wraps the Luna Kimi Bridge for AI generation.
 * The Luna bridge uses Playwright + CDP to drive the real Kimi web app.
 * Falls back gracefully to mock responses if the bridge is disabled or
 * Chrome/Kimi is not available.
 *
 * @module services/lpBridgeAdapter
 * @version 3.0.0
 */

const crypto = require('crypto');
const config = require('../config/nexo-lp-config');

// Lazy-load the Luna Kimi Bridge so failures during import don't crash the server.
let KimiBridgeModule = null;
try {
  KimiBridgeModule = require('./luna/kimi-bridge.cjs');
} catch (error) {
  console.warn('[BridgeAdapter] Failed to load Luna KimiBridge:', error.message);
}

const { KimiBridge } = KimiBridgeModule || {};

/**
 * Generate an isolated user ID for bridge context
 * @returns {string}
 */
function generateIsolatedUserId() {
  const timestamp = Date.now();
  const hash = crypto.randomBytes(4).toString('hex');
  return `nlp-${timestamp}-${hash}`;
}

/**
 * Create a structured event for SSE streaming
 * @param {string} type - Event type (action_start, action_end, action_error)
 * @param {string} phase - Generation phase
 * @param {object} data - Event data
 * @returns {object}
 */
function createEvent(type, phase, data = {}) {
  return {
    type,
    phase,
    timestamp: new Date().toISOString(),
    ...data,
  };
}

/**
 * Bridge Adapter class
 * Wraps communication with the Luna Kimi Bridge
 */
class BridgeAdapter {
  constructor() {
    this.enabled = config.kimiBridge.enabled && !!KimiBridge;
    this.cdpUrl = config.kimiBridge.cdpUrl;
    this.timeout = config.kimiBridge.timeout;
    this.maxPages = config.kimiBridge.maxPages;
    this.idleTimeout = config.kimiBridge.idleTimeout;
    this.cooldownMs = config.kimiBridge.cooldownMs;
    this.maxTypeLength = config.kimiBridge.maxTypeLength;
    this.mode = config.kimiBridge.mode;
    this.autoStartChrome = config.kimiBridge.autoStartChrome;
    this.reuseUserId = process.env.KIMI_BRIDGE_REUSE_USER_ID === 'true' || config.kimiBridge.reuseUserId || false;
    this.fixedUserId = this.reuseUserId ? (process.env.KIMI_BRIDGE_FIXED_USER_ID || `nexo-lp-test-${Date.now()}`) : null;
    this.bridge = null;
    this.connectPromise = null;
    this.disconnectScheduled = false;
  }

  /**
   * Initialize a new generation context
   * @param {string} sessionId
   * @param {object} persisted - Optional persisted bridge state { userId, chatUrl }
   * @returns {object} Context with isolated userId
   */
  initializeContext(sessionId, persisted = {}) {
    // Each NEXO session gets its own Kimi chat/user so multiple sites can be
    // generated in parallel without crosstalk. We only reuse persisted state
    // when resuming the exact same session.
    const userId = persisted.userId || generateIsolatedUserId();
    return {
      sessionId,
      userId,
      chatUrl: persisted.chatUrl || null,
      startTime: Date.now(),
      retries: 0,
      systemPromptSent: false,
    };
  }

  /**
   * Ensure the Luna bridge is connected.
   * Returns the shared bridge instance.
   * @returns {Promise<KimiBridge|null>}
   */
  async ensureBridge() {
    if (!this.enabled) {
      return null;
    }

    if (this.bridge) {
      return this.bridge;
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = (async () => {
      try {
        const bridge = new KimiBridge({
          cdpUrl: this.cdpUrl,
          timeout: this.timeout,
          maxPages: this.maxPages,
          idleTimeout: this.idleTimeout,
          debug: config.nodeEnv === 'development',
        });

        await bridge.connect();
        this.bridge = bridge;

        bridge.onClose = bridge.onClose || (() => {
          console.warn('[BridgeAdapter] Luna bridge connection closed');
          this.bridge = null;
        });

        console.log('[BridgeAdapter] Luna Kimi Bridge connected');
        return bridge;
      } catch (error) {
        console.error('[BridgeAdapter] Failed to connect Luna bridge:', error.message);
        this.enabled = false;
        return null;
      } finally {
        this.connectPromise = null;
      }
    })();

    return this.connectPromise;
  }

  /**
   * Send a message to the AI bridge and get response.
   * Internally streams so thinking/response events can be emitted via SSE.
   * @param {object} context - Generation context
   * @param {string} prompt - User prompt
   * @param {object} options - Additional options
   * @returns {Promise<object>} AI response
   */
  async sendMessage(context, prompt, options = {}) {
    const bridge = await this.ensureBridge();

    if (!bridge) {
      // Graceful fallback: tell the caller there is no real AI available.
      // The generation service will use mock data on error/recoverable paths.
      throw new Error('Luna bridge not available');
    }

    const { userId, sessionId } = context;
    const mode = options.mode || this.mode;
    const systemPrompt = this.buildSystemPrompt(options);

    // v3.2-fix: Kimi handles long combined prompts fine; sending a separate warm-up
    // message creates rate-limit races and leaves the chat in an ambiguous state.
    // Send system + user together in a single message, exactly like Luna Soul does.
    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;

    // v4.1-fix: Respect an explicit newChat request (e.g. code phase) even when
    // a chatUrl already exists. Otherwise default to reusing the existing chat.
    const shouldStartNewChat = options.newChat === true ? true : (!context.chatUrl && options.newChat !== false);
    return this._sendSingleMessage(context, fullPrompt, {
      ...options,
      mode,
      newChat: shouldStartNewChat,
    });
  }

  /**
   * Send a single message stream and aggregate the response.
   * @param {object} context
   * @param {string} prompt
   * @param {object} options
   * @returns {Promise<object>}
   */
  async _sendSingleMessage(context, prompt, options = {}) {
    const bridge = await this.ensureBridge();
    const { userId, sessionId } = context;
    const mode = options.mode || this.mode;

    let lastError = null;
    const maxRetries = options.maxRetries || 2;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        let fullContent = '';
        let thinkingContent = '';

        const stream = bridge.sendMessageStream(userId, prompt, {
          mode,
          newChat: options.newChat && attempt === 0 && context.retries === 0,
          ...options.bridgeParams,
        });

        for await (const event of stream) {
          // v12.0: No phase timeout — wait for Kimi to finish naturally.
          // Completion is detected by DOM text stability in the bridge.
          switch (event.type) {
            case 'thinking_start':
              this.emitEvent({
                type: 'thinking_start',
                phase: options.phase || 'generation',
                sessionId,
                message: 'Thinking...',
                timestamp: new Date().toISOString(),
              });
              break;
            case 'thinking_delta':
              if (event.text) {
                thinkingContent += event.text;
                this.emitEvent({
                  type: 'thinking_delta',
                  phase: options.phase || 'generation',
                  sessionId,
                  text: event.text,
                  fullThinking: thinkingContent,
                  timestamp: new Date().toISOString(),
                });
              }
              break;
            case 'response_delta':
              if (event.text) {
                fullContent += event.text;
                this.emitEvent({
                  type: 'response_delta',
                  phase: options.phase || 'generation',
                  sessionId,
                  text: event.text,
                  fullResponse: fullContent,
                  timestamp: new Date().toISOString(),
                });
              }
              break;
            case 'response_detected':
              if (event.response) {
                fullContent = event.response;
                this.emitEvent({
                  type: 'response_delta',
                  phase: options.phase || 'generation',
                  sessionId,
                  text: '',
                  fullResponse: fullContent,
                  timestamp: new Date().toISOString(),
                });
              }
              break;
            case 'action_detected':
              this.emitEvent({
                type: 'action_detected',
                phase: options.phase || 'generation',
                sessionId,
                action: event.action,
                timestamp: new Date().toISOString(),
              });
              break;
            case 'done':
              // Stream complete — capture final response if deltas were not emitted
              if (event.response && !fullContent) {
                fullContent = event.response;
              }
              break;
            default:
              // Ignore unknown events
              break;
          }
        }

        // Capture the real Kimi web chat URL for this user/session
        let chatUrl = null;
        try {
          const bridgeSession = bridge.userSessions?.get(userId);
          if (bridgeSession) {
            chatUrl = bridgeSession.chatUrl || bridgeSession.page?.url() || null;
          }
          if (!chatUrl && bridgeSession?.page) {
            chatUrl = await bridgeSession.page.url().catch(() => null);
          }
        } catch (urlErr) {
          console.warn('[BridgeAdapter] Could not capture chatUrl:', urlErr.message);
        }
        if (chatUrl) {
          context.chatUrl = chatUrl;
        }

        return {
          success: true,
          content: fullContent || '',
          chatUrl: context.chatUrl,
          mode,
        };
      } catch (error) {
        lastError = error;
        context.retries++;

        // If Kimi rate-limits us, wait the requested cooldown before retrying
        const rateLimitMatch = error.message?.match(/Aguarde (\d+)s?/i);
        if (rateLimitMatch && attempt < maxRetries - 1) {
          const waitSeconds = parseInt(rateLimitMatch[1], 10) || 5;
          console.warn(`[BridgeAdapter] Rate limited — waiting ${waitSeconds}s before retry`);
          await this.sleep(waitSeconds * 1000);
        } else if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000;
          await this.sleep(delay);
        }
      }
    }

    throw new Error(`Bridge request failed after ${maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Try to fetch an attached/downloadable HTML file that Kimi created in the
   * chat (e.g. "Download: sanitized.html"). Falls back to null if the file
   * cannot be located or fetched.
   * @param {object} context - Generation context with userId
   * @param {string} text - Kimi text response, used as a hint to locate the file
   * @returns {Promise<string|null>}
   */
  async fetchAttachedHtml(context, text) {
    const bridge = await this.ensureBridge();
    if (!bridge) return null;

    const session = bridge.userSessions?.get(context.userId);
    const page = session?.page;
    if (!page) return null;

    // Look for an .html file reference in the response as a hint.
    const fileHintMatch = String(text || '').match(/([a-zA-Z0-9_-]+\.html)/i);
    const fileHint = fileHintMatch ? fileHintMatch[1] : null;

    try {
      const fileUrl = await page.evaluate((hint) => {
        const links = Array.from(document.querySelectorAll('a'));
        const match = links.find((a) => {
          const href = (a.href || '').toLowerCase();
          const txt = (a.textContent || '').toLowerCase();
          if (href.endsWith('.html')) return true;
          if (hint && (txt.includes(hint.toLowerCase()) || href.includes(hint.toLowerCase()))) return true;
          return false;
        });
        return match ? match.href : null;
      }, fileHint);

      if (!fileUrl) return null;

      console.log(`[BridgeAdapter][${context.userId}] Fetching attached HTML file: ${fileUrl}`);
      const content = await page.evaluate(async (url) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      }, fileUrl);

      return content;
    } catch (err) {
      console.warn(`[BridgeAdapter][${context.userId}] Failed to fetch attached HTML:`, err.message);
      return null;
    }
  }

  /**
   * Send a streaming message to the AI bridge
   * @param {object} context - Generation context
   * @param {string} prompt - User prompt
   * @param {Function} onChunk - Callback for each chunk
   * @param {object} options - Additional options
   */
  async sendStreamMessage(context, prompt, onChunk, options = {}) {
    const bridge = await this.ensureBridge();

    if (!bridge) {
      throw new Error('Luna bridge not available');
    }

    const { userId } = context;
    const mode = options.mode || this.mode;
    const systemPrompt = this.buildSystemPrompt(options);
    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;

    const stream = bridge.sendMessageStream(userId, fullPrompt, {
      mode,
      newChat: context.retries === 0,
      ...options.bridgeParams,
    });

    let fullContent = '';

    for await (const event of stream) {
      switch (event.type) {
        case 'response_delta':
        case 'thinking_delta':
          if (event.text) {
            fullContent += event.text;
            onChunk({ content: event.text, fullContent, done: false });
          }
          break;
        case 'response_detected':
          if (event.response) {
            fullContent = event.response;
            onChunk({ content: event.response, fullContent, done: false });
          }
          break;
        case 'done': {
          const finalContent = event.response || fullContent;
          onChunk({ content: '', fullContent: finalContent, done: true });
          return;
        }
        case 'action_detected':
          // Forward tool/action events if needed
          onChunk({ content: '', fullContent, done: false, action: event.action });
          break;
        default:
          // Ignore unknown events
          break;
      }
    }

    onChunk({ content: '', fullContent, done: true });
  }

  /**
   * Build the system prompt for the AI
   * @param {object} options
   * @returns {string}
   */
  buildSystemPrompt(options = {}) {
    // v4.0-fix: The per-phase prompts already contain full persona, stack rules,
    // and output format instructions. A generic system prompt here only adds
    // conflicting instructions (e.g. "wait for user prompt") and confuses Kimi.
    // Returning empty keeps each phase prompt self-contained and authoritative.
    return '';
  }

  /**
   * Emit an event to be consumed via SSE
   * @param {object} event
   */
  emitEvent(event) {
    const { emitGenerationEvent } = require('./lpGenerationService');
    if (emitGenerationEvent) {
      emitGenerationEvent(event);
    }
  }

  /**
   * Sleep utility for retry delays
   * @param {number} ms
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get the real Kimi web chat URL for a context
   * @param {object} context
   * @returns {string|null}
   */
  getChatUrl(context) {
    if (!context) return null;
    if (context.chatUrl) return context.chatUrl;
    try {
      const session = this.bridge?.userSessions?.get(context.userId);
      return session?.chatUrl || session?.page?.url() || null;
    } catch {
      return null;
    }
  }

  /**
   * Cancel an active stream for a user/session.
   */
  async cancelStream(context, soft = false) {
    const bridge = await this.ensureBridge();
    if (!bridge || !context?.userId) return false;
    try {
      await bridge.cancelStream(context.userId, soft);
      return true;
    } catch (err) {
      console.warn('[BridgeAdapter] cancelStream failed:', err.message);
      return false;
    }
  }

  /**
   * Disconnect the bridge (graceful shutdown)
   */
  async disconnect() {
    if (this.bridge) {
      try {
        await this.bridge.disconnect();
      } catch (error) {
        console.error('[BridgeAdapter] Error disconnecting bridge:', error.message);
      } finally {
        this.bridge = null;
      }
    }
  }
}

// Export singleton
module.exports = new BridgeAdapter();
