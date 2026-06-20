/**
 * NEXO Landing Page Creator v3.0 - Generation Service
 *
 * Orchestrates the AI generation flow through the bridge adapter.
 * Manages the generation lifecycle: intention, structure, code,
 * review, preview, and deploy phases.
 *
 * Uses the real Kimi bridge for all generation. Fallback helpers
 * remain only as emergency safety nets when a phase fails.
 *
 * @module services/lpGenerationService
 * @version 3.0.0
 */

const SessionRepository = require('../models/repositories/SessionRepository');
const PreviewService = require('./lpPreviewService');
const BridgeAdapter = require('./lpBridgeAdapter.cjs');
const lpSessionService = require('./lpSessionService');
const lpVersionService = require('./lpVersionService');
const lpTemplateService = require('./lpTemplateService');
const lpBugDetectorService = require('./lpBugDetectorService');
const lpRebuildEngine = require('./lpRebuildEngine');
const config = require('../config/nexo-lp-config');
const { ResponseParser, ReviewValidationError } = require('./luna/ResponseParser.cjs');
const {
  intentionPrompt,
  structurePrompt,
  codePrompt,
  reviewPrompt,
  fixPrompt,
  reviewRetryPrompt,
} = require('./prompts/nexoPromptPack');

// Store active SSE connections by sessionId
const eventStreams = new Map();

// Store active generation contexts
const generationContexts = new Map();

/**
 * Register an SSE event stream for a session
 * @param {string} sessionId
 * @param {object} res - Express response object
 */
function registerEventStream(sessionId, res) {
  eventStreams.set(sessionId, res);
}

/**
 * Unregister an SSE event stream
 * @param {string} sessionId
 */
function unregisterEventStream(sessionId) {
  eventStreams.delete(sessionId);
}

/**
 * Close all active SSE streams
 */
function closeAllStreams() {
  for (const [sessionId, res] of eventStreams) {
    try {
      res.end();
    } catch {
      // Ignore errors on close
    }
  }
  eventStreams.clear();
}

/**
 * Emit an event to the SSE stream for a session
 * @param {string} sessionId
 * @param {object} event
 */
function emitToStream(sessionId, event) {
  const res = eventStreams.get(sessionId);
  if (!res) return;

  try {
    // Send all events as the default 'message' type so the frontend's
    // EventSource.onmessage receives them without per-type listeners.
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  } catch (error) {
    console.error(`[GenerationService] Failed to emit event for session ${sessionId}:`, error.message);
    unregisterEventStream(sessionId);
  }
}

/**
 * Global event emitter for bridge adapter
 * @param {object} event
 */
function emitGenerationEvent(event) {
  if (event.sessionId) {
    emitToStream(event.sessionId, event);
  }
}

/**
 * Send event for a specific phase
 * @param {string} sessionId
 * @param {string} type - action_start or action_end
 * @param {string} phase
 * @param {object} data
 */
function sendPhaseEvent(sessionId, type, phase, data = {}) {
  const event = {
    type,
    phase,
    sessionId,
    timestamp: new Date().toISOString(),
    ...data,
  };
  emitToStream(sessionId, event);
}

/**
 * Sleep utility
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generation phase prompts
 */
const PHASE_PROMPTS = {
  intention: (prompt) => intentionPrompt(prompt),
  structure: (intention) => structurePrompt(intention),
  code: (structure, stack) => codePrompt(structure, stack),
  review: (html) => reviewPrompt(html),
  fix: (html, review) => fixPrompt(html, review),
  preview: () => 'Prepare preview metadata.',
  deploy: () => 'Prepare deployment configuration.',
};

const CONTINUE_PROMPT = `You just output a plan/JSON instead of real HTML. STOP. Now generate the complete, self-contained landing page HTML file only. Wrap the entire code in one markdown HTML code block (\`\`\`html ... \`\`\`). It must start with <!DOCTYPE html> and end with </html>. No explanations, no JSON, no summaries, no design briefs.`;
const MAX_REVIEW_RETRIES = 2;
const MAX_CONTINUE_ATTEMPTS = 5;

const REVIEW_RETRY_PROMPT = (html, reason, rawResponse) =>
  reviewRetryPrompt(html, reason, rawResponse);

/**
 * Detect if a response is just intermediate metadata JSON and not real code.
 * Kimi sometimes emits a JSON block with preview/seo/assets/structure/performance
 * before it finishes generating the actual HTML.
 */
function looksLikeMetadataJson(text) {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('"')) return false;

  // If it contains HTML code markers, it's real code — not metadata
  const lower = trimmed.toLowerCase();
  if (lower.includes('<!doctype') || lower.includes('<html') || lower.includes('<div') || lower.includes('<section')) {
    return false;
  }

  try {
    const parsed = JSON.parse(trimmed);
    // Intermediate metadata objects that Kimi emits before the actual HTML
    const metadataKeys = [
      'preview', 'seo', 'assets', 'structure', 'performance',
      'designTokens', 'responsiveBreakpoints', 'imageStrategy', 'croStrategy',
      'layout', 'sections', 'navigation', 'typography', 'motion', 'croStrategy',
    ];
    const hasMetadataKeys = metadataKeys.some((key) => parsed && typeof parsed[key] !== 'undefined');
    // Also catch a design-brief JSON that has layout + sections but no actual HTML
    const looksLikeBrief = parsed && typeof parsed.layout === 'string' && Array.isArray(parsed.sections);
    return hasMetadataKeys || looksLikeBrief;
  } catch {
    // Fragmented JSON that still looks like a design brief (no HTML markers above)
    const fragmentMarkers = ['"layout"', '"designTokens"', '"sections"', '"responsiveBreakpoints"', '"croStrategy"', '"imageStrategy"'];
    return fragmentMarkers.some((m) => trimmed.includes(m));
  }
}

/**
 * Detect if a text contains real landing page / app code.
 */
function hasRealCode(text) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase();
  const codeMarkers = [
    '<!doctype',
    '<html',
    '<div',
    '<section',
    'export default',
    'function app',
    'const app',
    'createapp',
    'reactdom',
    '<template',
    '<script',
    '<style',
  ];
  return codeMarkers.some((marker) => lower.includes(marker));
}

/**
 * Detect when Kimi refuses to continue because the conversation is too long.
 */
function isConversationTooLong(text) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase();
  return lower.includes('conversation with kimi is getting too long') || lower.includes('try starting a new session');
}

class GenerationService {
  constructor() {
    this.phases = ['intention', 'structure', 'code', 'review', 'preview', 'deploy'];
  }

  /**
   * Start the generation process for a session
   * @param {string} sessionId
   * @param {string} prompt - User's natural language prompt
   * @param {string} stack - Technology stack
   * @param {object} options - Additional options
   */
  async startGeneration(sessionId, prompt, stack, options = {}) {
    try {
      // Persist the user's prompt as a message
      await lpSessionService.addMessage(sessionId, {
        role: 'user',
        content: prompt,
        type: 'text',
      });

      // Update session status
      await SessionRepository.updateStatus(sessionId, 'intention');
      await SessionRepository.updateMetadata(sessionId, { generationStarted: new Date().toISOString() });

      // Load any persisted bridge state (real Kimi chat URL/userId) for this session
      const session = await SessionRepository.findById(sessionId);
      let metadata = {};
      if (session?.metadata_json) {
        try {
          metadata = JSON.parse(session.metadata_json);
        } catch (parseErr) {
          console.warn(`[GenerationService][${sessionId}] Failed to parse persisted metadata_json: ${parseErr.message}`);
          metadata = {};
        }
      }
      const persistedBridge = {
        userId: metadata.kimiUserId || null,
        chatUrl: metadata.kimiChatUrl || null,
      };

      // Store generation context
      const context = BridgeAdapter.initializeContext(sessionId, persistedBridge);
      context.stack = stack || config.stacks.default;
      context.prompt = prompt;
      context.options = options;
      generationContexts.set(sessionId, context);

      // Run generation phases (always real Kimi bridge — mock mode removed)
      await this.runRealGeneration(sessionId, prompt, stack, options);
    } catch (error) {
      console.error(`[GenerationService] Generation failed for session ${sessionId}:`, error.message, error.stack);
      sendPhaseEvent(sessionId, 'action_error', 'generation', {
        error: error.message,
        recoverable: false,
      });
      await SessionRepository.updateStatus(sessionId, 'failed');
    } finally {
      generationContexts.delete(sessionId);
    }
  }

  /**
   * Run real generation with AI bridge
   * @param {string} sessionId
   * @param {string} prompt
   * @param {string} stack
   */
  async runRealGeneration(sessionId, prompt, stack, options = {}) {
    const context = generationContexts.get(sessionId);
    const selectedStack = stack || config.stacks.default;
    const phaseTimeoutMs = config.kimiBridge.timeout === 0 ? 0 : (config.kimiBridge.timeout || 30 * 60 * 1000);
    const interPhaseDelayMs = config.kimiBridge.cooldownMs || 5000;

    let currentHtml = '';
    let lastValidHtml = '';

    // Persist the bridge userId so the same Kimi page/chat is reused for this session
    if (context.userId) {
      await SessionRepository.updateMetadata(sessionId, { kimiUserId: context.userId });
    }

    for (const phase of this.phases) {
      if (phase === 'deploy' || phase === 'preview') continue; // Deploy handled separately; preview is local

      // Start phase
      sendPhaseEvent(sessionId, 'action_start', phase, {
        message: this.getPhaseMessage(phase, 'start'),
      });

      // Update session status
      await SessionRepository.updateStatus(sessionId, phase);

      // Build prompt for this phase
      let phasePrompt;
      switch (phase) {
        case 'intention':
          phasePrompt = PHASE_PROMPTS.intention(prompt);
          break;
        case 'structure':
          phasePrompt = PHASE_PROMPTS.structure(context.intention);
          break;
        case 'code':
          phasePrompt = PHASE_PROMPTS.code(context.structure, selectedStack);
          break;
        case 'review':
          phasePrompt = PHASE_PROMPTS.review(currentHtml);
          break;
        default:
          phasePrompt = prompt;
      }

      try {
        let response;

        if (phase === 'code') {
          // Code phase may need auto-continue when Kimi emits intermediate metadata JSON.
          // Keep the same chat context (intention + structure) so Kimi directly outputs
          // the HTML file instead of restarting from scratch in a new chat.
          response = await this.runCodePhaseWithContinue(sessionId, context, phasePrompt, selectedStack, phaseTimeoutMs, false);
        } else {
          response = await this.sendMessageWithoutHardTimeout(context, phasePrompt, {
            stack: selectedStack,
            phase,
            phaseTimeoutMs,
          });
        }

        const content = response.content || '';
        console.log(`[GenerationService][${sessionId}][${phase}] bridge response length=${content.length}, first200=${content.substring(0, 200).replace(/\n/g, ' ')}`);

        // Persist real Kimi chat URL whenever we have one
        if (response.chatUrl || context.chatUrl) {
          context.chatUrl = response.chatUrl || context.chatUrl;
          await SessionRepository.updateMetadata(sessionId, { kimiChatUrl: context.chatUrl });
        }

        // Process phase result
        switch (phase) {
          case 'intention':
            context.intention = this.safeJsonParse(content, this.generateMockIntention(prompt));
            break;
          case 'structure':
            context.structure = this.safeJsonParse(content, this.generateMockStructure(context.intention));
            break;
          case 'code':
            currentHtml = this.extractHtmlFromResponse(content);
            await SessionRepository.updateGeneratedCode(sessionId, { html: currentHtml, css: '', js: '' });

            // Snapshot the raw generated code before QA review
            try {
              await lpVersionService.saveVersion(sessionId, {
                html: currentHtml,
                css: '',
                js: '',
                note: 'Generated code (before review)',
                metadata: { source: 'code-before-review', stack: selectedStack, isComplete: lpVersionService.isHtmlComplete(currentHtml) },
              });
            } catch (versionErr) {
              console.error(`[GenerationService][${sessionId}] pre-review version snapshot failed:`, versionErr.message);
            }

            if (lpVersionService.isHtmlComplete(currentHtml)) {
              lastValidHtml = currentHtml;
            }
            break;
          case 'review': {
            let reviewContent = content;
            let lastReviewError = null;
            for (let attempt = 1; attempt <= MAX_REVIEW_RETRIES; attempt += 1) {
              try {
                context.review = this.parseReviewResponse(reviewContent, currentHtml, sessionId);
                lastReviewError = null;
                break;
              } catch (err) {
                lastReviewError = err;
                console.warn(`[GenerationService][${sessionId}][review] parse attempt ${attempt}/${MAX_REVIEW_RETRIES} failed: ${err.reason || err.message}`);
                if (attempt === MAX_REVIEW_RETRIES) {
                  break;
                }
                const retryPhase = `review-retry-${attempt}`;
                sendPhaseEvent(sessionId, 'action_start', retryPhase, {
                  message: `Review parse failed — retrying QA (${attempt}/${MAX_REVIEW_RETRIES})...`,
                  attempt,
                });
                const retryPrompt = REVIEW_RETRY_PROMPT(currentHtml, err.reason || 'invalid JSON', reviewContent);
                const retryResponse = await this.sendMessageWithoutHardTimeout(context, retryPrompt, {
                  stack: selectedStack,
                  phase: 'review',
                  phaseTimeoutMs,
                });
                reviewContent = retryResponse.content || '';
                sendPhaseEvent(sessionId, 'action_end', retryPhase, {
                  message: `Review retry ${attempt} complete`,
                  attempt,
                });
              }
            }
            if (lastReviewError) {
              sendPhaseEvent(sessionId, 'action_error', `review-retry-${MAX_REVIEW_RETRIES}`, {
                error: lastReviewError.message,
              });
              // v4.2-fix: Don't fail the whole generation just because Kimi didn't
              // return a parseable review JSON. Publish as unreviewed instead.
              console.warn(`[GenerationService][${sessionId}] Review parse failed after retries — publishing as unreviewed`);
              context.review = {
                score: 70,
                passed: false,
                issues: [{ severity: 'warning', message: `Review response was not parseable: ${lastReviewError.reason || lastReviewError.message}` }],
                suggestions: ['Re-run manual QA when convenient'],
                metadata: { rebuildNeeded: false, rebuildInstructions: [], reviewParseFailed: true },
              };
            }
            this.normalizeReviewResult(context.review, currentHtml);
            break;
          }
        }

        sendPhaseEvent(sessionId, 'action_end', phase, {
          message: this.getPhaseMessage(phase, 'end'),
          result: context[phase] || (phase === 'code' ? { stack: selectedStack, fileCount: 1, htmlLength: currentHtml.length } : { completed: true }),
        });

        // Respect Kimi rate-limit cooldown between phases
        await sleep(interPhaseDelayMs);
      } catch (error) {
        console.error(`[GenerationService][${sessionId}][${phase}] phase error:`, error.message);
        sendPhaseEvent(sessionId, 'action_error', phase, {
          error: error.message,
          recoverable: true,
        });

        // Review phase has no fallback: if Kimi cannot produce a parseable review,
        // we must fail fast instead of publishing unchecked code.
        if (phase === 'review') {
          throw error;
        }

        // Continue with mock/local data on error so the user still gets something
        if (phase === 'intention') context.intention = this.generateMockIntention(prompt);
        if (phase === 'structure') context.structure = this.generateMockStructure(context.intention);
        if (phase === 'code') {
          currentHtml = this.generateLocalHtml(prompt, context.intention, selectedStack);
          console.log(`[GenerationService][${sessionId}][code] fallback local HTML length=${currentHtml.length}`);
          await SessionRepository.updateGeneratedCode(sessionId, { html: currentHtml, css: '', js: '' });
        }
      }
    }

    // If review failed, attempt to rebuild and re-review the code
    if (context.review && !context.review.passed) {
      const maxRebuildAttempts = config.rebuild.maxAttempts || 3;
      for (let attempt = 1; attempt <= maxRebuildAttempts; attempt++) {
        const fixPhase = `fix-${attempt}`;
        const reReviewPhase = `re-review-${attempt}`;

        // 1. Ask Kimi to fix the identified issues
        let stopRebuild = false;
        sendPhaseEvent(sessionId, 'action_start', fixPhase, {
          message: `Corrigindo código (tentativa ${attempt}/${maxRebuildAttempts})...`,
          attempt,
          previousReview: context.review,
        });
        try {
          const fixInstructions = this.extractFixInstructions(context.review);
          const fixPrompt = PHASE_PROMPTS.fix(currentHtml, fixInstructions);
          const fixResponse = await this.runCodePhaseWithContinue(sessionId, context, fixPrompt, selectedStack, phaseTimeoutMs);
          if (isConversationTooLong(fixResponse.content || '')) {
            console.warn(`[GenerationService][${sessionId}] Kimi reported conversation too long; stopping rebuild loop`);
            sendPhaseEvent(sessionId, 'action_error', fixPhase, {
              error: 'Conversation with Kimi is too long; stopping auto-rebuild.',
              recoverable: false,
            });
            stopRebuild = true;
          } else {
            const htmlBeforeFix = currentHtml;
            const fixedHtml = this.extractHtmlFromResponse(fixResponse.content || '');
            if (hasRealCode(fixedHtml)) {
              currentHtml = fixedHtml;
              await SessionRepository.updateGeneratedCode(sessionId, { html: currentHtml, css: '', js: '' });
              if (lpVersionService.isHtmlComplete(currentHtml)) {
                lastValidHtml = currentHtml;
              }
              console.log(`[GenerationService][${sessionId}] AI fix attempt ${attempt} applied, html length=${currentHtml.length}`);
              if (htmlBeforeFix === currentHtml) {
                console.warn(`[GenerationService][${sessionId}] WARNING: Fix attempt ${attempt} produced NO CHANGES. Stopping rebuild loop to avoid infinite cycle.`);
                sendPhaseEvent(sessionId, "action_error", fixPhase, {
                  error: `Fix attempt ${attempt} produced no changes. The AI returned identical HTML.`,
                  recoverable: false,
                });
                stopRebuild = true;
              }
            }
          }
        } catch (fixErr) {
          console.error(`[GenerationService][${sessionId}] AI fix attempt ${attempt} failed:`, fixErr.message);
        }

        if (stopRebuild) break;

        // 2. Apply local auto-fixes as a safety net
        try {
          const localReport = await lpBugDetectorService.detect(sessionId, currentHtml);
          if (!localReport.passed && localReport.issues && localReport.issues.length > 0) {
            const rebuildResult = await lpRebuildEngine.rebuild(sessionId, currentHtml, localReport.issues, 1);
            if (rebuildResult.fixesApplied.length > 0) {
              currentHtml = rebuildResult.html;
              await SessionRepository.updateGeneratedCode(sessionId, { html: currentHtml, css: '', js: '' });
              if (lpVersionService.isHtmlComplete(currentHtml)) {
                lastValidHtml = currentHtml;
              }
              console.log(`[GenerationService][${sessionId}] local fix attempt ${attempt} applied: ${rebuildResult.fixesApplied.length} fixes`);
            }
          }
        } catch (localErr) {
          console.error(`[GenerationService][${sessionId}] local rebuild attempt ${attempt} failed:`, localErr.message);
        }

        sendPhaseEvent(sessionId, 'action_end', fixPhase, {
          message: `Correção ${attempt} finalizada`,
          attempt,
        });

        if (stopRebuild) break;

        // 3. Re-run QA review
        sendPhaseEvent(sessionId, 'action_start', reReviewPhase, {
          message: `Reverificando qualidade (tentativa ${attempt}/${maxRebuildAttempts})...`,
          attempt,
        });
        try {
          const reReviewPrompt = PHASE_PROMPTS.review(currentHtml);
          const reReviewResponse = await this.sendMessageWithoutHardTimeout(context, reReviewPrompt, {
            stack: selectedStack,
            phase: 'review',
            phaseTimeoutMs,
          });
          if (isConversationTooLong(reReviewResponse.content || '')) {
            console.warn(`[GenerationService][${sessionId}] Kimi reported conversation too long during re-review; stopping rebuild loop`);
            sendPhaseEvent(sessionId, 'action_error', reReviewPhase, {
              error: 'Conversation with Kimi is too long; stopping auto-rebuild.',
              recoverable: false,
            });
            stopRebuild = true;
          } else {
            context.review = await this.parseReviewResponse(reReviewResponse.content || '', currentHtml, sessionId);
            this.normalizeReviewResult(context.review, currentHtml);
            console.log(`[GenerationService][${sessionId}] re-review attempt ${attempt}: passed=${context.review.passed}, score=${context.review.score}`);
          }
        } catch (reviewErr) {
          console.error(`[GenerationService][${sessionId}] re-review attempt ${attempt} failed:`, reviewErr.message);
          sendPhaseEvent(sessionId, 'action_error', reReviewPhase, {
            error: reviewErr.message,
            recoverable: true,
          });
        }

        sendPhaseEvent(sessionId, 'action_end', reReviewPhase, {
          message: `Reverificação ${attempt} finalizada`,
          attempt,
          result: {
            passed: !!context.review?.passed,
            score: context.review?.score,
          },
        });

        if (stopRebuild) break;

        if (context.review?.passed) {
          break;
        }

        await sleep(interPhaseDelayMs);
      }
    }

    // Always keep the session on the last complete HTML. If the final code is
    // truncated or broken, roll back to the most recent valid snapshot.
    if (lastValidHtml && !lpVersionService.isHtmlComplete(currentHtml)) {
      currentHtml = lastValidHtml;
      await SessionRepository.updateGeneratedCode(sessionId, { html: currentHtml, css: '', js: '' });
      console.log(`[GenerationService][${sessionId}] rolled back to last complete HTML (${currentHtml.length} chars)`);
    }

    // Snapshot the final code after QA review / rebuild loop
    try {
      await lpVersionService.saveVersion(sessionId, {
        html: currentHtml,
        css: '',
        js: '',
        note: 'Final code after review',
        metadata: { source: 'code-after-review', stack: selectedStack, isComplete: lpVersionService.isHtmlComplete(currentHtml), reviewPassed: !!context.review?.passed },
      });
    } catch (versionErr) {
      console.error(`[GenerationService][${sessionId}] post-review version snapshot failed:`, versionErr.message);
    }

    // Preview is generated locally (no AI prompt needed)
    sendPhaseEvent(sessionId, 'action_start', 'preview', {
      message: this.getPhaseMessage('preview', 'start'),
    });
    await SessionRepository.updateStatus(sessionId, 'preview');
    try {
      await PreviewService.savePreview(sessionId, currentHtml);
      sendPhaseEvent(sessionId, 'action_end', 'preview', {
        message: this.getPhaseMessage('preview', 'end'),
        result: { completed: true },
      });
    } catch (previewErr) {
      console.error(`[GenerationService][${sessionId}] preview save failed:`, previewErr.message);
      sendPhaseEvent(sessionId, 'action_error', 'preview', {
        error: previewErr.message,
        recoverable: true,
      });
    }

    // Publish to LOJA
    console.info(`[GenerationService][${sessionId}] Publishing to LOJA...`);
    try {
      const session = await SessionRepository.findById(sessionId);
      const userId = session?.user_id || context.userId || options.userId;
      const reviewPassed = !!context.review?.passed;

      if (reviewPassed) {
        const publishedTemplate = await lpTemplateService.publishFromSession(sessionId, userId);
        console.info(`[GenerationService][${sessionId}] Published to LOJA: ${publishedTemplate.id}`);
        sendPhaseEvent(sessionId, 'action_end', 'publish', {
          message: 'Published to LOJA',
          success: true,
          templateId: publishedTemplate.id,
          publicPreviewToken: publishedTemplate.public_preview_token,
        });
      } else {
        const publishedTemplate = await lpTemplateService.publishUnreviewedFromSession(sessionId, userId, 'review-failed');
        console.info(`[GenerationService][${sessionId}] Published to LOJA as unreviewed: ${publishedTemplate.id}`);
        sendPhaseEvent(sessionId, 'action_end', 'publish', {
          message: 'Published to LOJA as unreviewed (discounted)',
          success: true,
          unreviewed: true,
          templateId: publishedTemplate.id,
          publicPreviewToken: publishedTemplate.public_preview_token,
        });
      }
    } catch (publishErr) {
      console.error(`[GenerationService][${sessionId}] LOJA publish failed: ${publishErr.message}`);
      sendPhaseEvent(sessionId, 'action_end', 'publish', {
        message: `LOJA publish failed: ${publishErr.message}`,
        success: false,
      });
    }

    // Save metadata
    await SessionRepository.updateMetadata(sessionId, {
      intention: context.intention,
      structure: context.structure,
      review: context.review,
      generatedAt: new Date().toISOString(),
    });

    // Final event
    const preview = await PreviewService.getPreview(sessionId);
    const completionMessage = 'Generation complete! Your landing page is ready.';
    await lpSessionService.addMessage(sessionId, {
      role: 'assistant',
      content: completionMessage,
      type: 'text',
      metadata: { previewUrl: preview?.previewUrl || null, kimiChatUrl: context.chatUrl },
    });

    const session = await SessionRepository.findById(sessionId);
    const contextInfo = await lpSessionService.getContextInfo(session);

    sendPhaseEvent(sessionId, 'action_end', 'generation', {
      message: completionMessage,
      completed: true,
      previewUrl: preview?.previewUrl || null,
      kimiChatUrl: context.chatUrl,
      ...contextInfo,
    });
  }

  /**
   * Send a message to the bridge. No hard timeout — waits for Kimi to finish naturally.
   */
  async sendMessageWithoutHardTimeout(context, prompt, options) {
    return BridgeAdapter.sendMessage(context, prompt, options);
  }

  /**
   * Run the code phase with auto-continue when Kimi emits intermediate metadata JSON.
   * This keeps the same chat context and sends "continue" until real code appears.
   */
  async runCodePhaseWithContinue(sessionId, context, initialPrompt, selectedStack, phaseTimeoutMs, startNewChat = false) {
    let prompt = initialPrompt;
    let lastResponse = null;

    for (let attempt = 1; attempt <= MAX_CONTINUE_ATTEMPTS; attempt++) {
      lastResponse = await this.sendMessageWithoutHardTimeout(context, prompt, {
        stack: selectedStack,
        phase: 'code',
        phaseTimeoutMs,
        newChat: startNewChat && attempt === 1,
        // v12.3-fix: tell the bridge not to stop at metadata JSON; wait for </html>
        requiredHtmlClose: true,
      });

      const content = lastResponse.content || '';
      const extractedHtml = this.extractHtmlFromResponse(content);
      const htmlLooksComplete =
        hasRealCode(extractedHtml) &&
        /<\/html\s*>/i.test(extractedHtml) &&
        extractedHtml.length > 1000;

      // If we got a complete HTML file, we are done
      if (htmlLooksComplete) {
        return { ...lastResponse, content: extractedHtml };
      }

      // If the response looks like intermediate metadata JSON or incomplete HTML,
      // ask Kimi to continue generating the actual complete HTML file.
      if (looksLikeMetadataJson(content) || !hasRealCode(extractedHtml) || !/<\/html\s*>/i.test(extractedHtml)) {
        const reason = looksLikeMetadataJson(content)
          ? 'metadata JSON detected'
          : (!hasRealCode(extractedHtml) ? 'no real HTML found' : 'HTML missing closing </html>');
        console.log(`[GenerationService][${sessionId}][code] ${reason} (attempt ${attempt}), sending continue`);
        sendPhaseEvent(sessionId, 'action_continue', 'code', {
          message: `Continuing code generation (${reason})...`,
          attempt,
        });
        prompt = CONTINUE_PROMPT;
        continue;
      }

      // Fallback: return what we have
      return lastResponse;
    }

    console.warn(`[GenerationService][${sessionId}][code] reached max continue attempts (${MAX_CONTINUE_ATTEMPTS})`);
    return lastResponse;
  }

  /**
   * Generate mock intention from user prompt
   * @param {string} prompt
   * @returns {object}
   */
  generateMockIntention(prompt) {
    const lower = prompt.toLowerCase();
    const sections = [];

    if (lower.includes('product') || lower.includes('saas')) sections.push('hero', 'features', 'pricing', 'cta');
    else if (lower.includes('portfolio')) sections.push('hero', 'about', 'gallery', 'contact');
    else if (lower.includes('event')) sections.push('hero', 'details', 'schedule', 'register');
    else if (lower.includes('startup')) sections.push('hero', 'problem', 'solution', 'team', 'cta');
    else sections.push('hero', 'features', 'testimonials', 'cta', 'footer');

    return {
      title: prompt.split('.')[0].substring(0, 60),
      description: prompt.substring(0, 200),
      sections: [...new Set(sections)],
      style: {
        tone: lower.includes('professional') ? 'professional' : lower.includes('fun') ? 'playful' : 'modern',
        colors: { primary: '#3B82F6', secondary: '#1E293B', accent: '#10B981' },
        typography: 'modern',
      },
      target: {
        audience: lower.includes('b2b') ? 'business' : lower.includes('developer') ? 'developers' : 'general',
        purpose: lower.includes('lead') ? 'lead-gen' : lower.includes('sale') ? 'sales' : 'branding',
      },
    };
  }

  /**
   * Generate mock structure from intention
   * @param {object} intention
   * @returns {object}
   */
  generateMockStructure(intention) {
    const sections = (intention.sections || []).map((section, index) => ({
      id: section,
      type: `${section}-section`,
      components: this.getSectionComponents(section),
      order: index + 1,
    }));

    return {
      layout: 'single-page',
      sections,
      navigation: sections.length > 2,
      responsive_breakpoints: ['mobile', 'tablet', 'desktop'],
    };
  }

  /**
   * Get components for a section type
   * @param {string} section
   * @returns {string[]}
   */
  getSectionComponents(section) {
    const componentMap = {
      hero: ['heading', 'subheading', 'cta-button', 'hero-image'],
      features: ['feature-grid', 'feature-cards', 'icon-list'],
      pricing: ['pricing-cards', 'toggle-monthly-yearly', 'cta'],
      testimonials: ['testimonial-cards', 'ratings', 'author-info'],
      cta: ['heading', 'subheading', 'cta-button', 'trust-badges'],
      footer: ['logo', 'links', 'social', 'copyright'],
      about: ['heading', 'paragraph', 'image', 'stats'],
      gallery: ['image-grid', 'lightbox', 'filters'],
      contact: ['form', 'info-cards', 'map'],
      team: ['team-cards', 'social-links', 'bios'],
      details: ['info-cards', 'highlights', 'images'],
      schedule: ['timeline', 'sessions', 'speakers'],
      register: ['form', 'pricing', 'benefits'],
      problem: ['heading', 'pain-points', 'stats'],
      solution: ['heading', 'features', 'demo'],
    };

    return componentMap[section] || ['heading', 'content'];
  }

  /**
   * Build a personalized landing page HTML locally when the AI bridge is
   * unavailable or returns empty. The copy is derived from the user's prompt
   * so the page never feels like a generic template.
   * @param {string} prompt
   * @param {object} intention
   * @param {string} stack
   * @returns {string}
   */
  generateLocalHtml(prompt, intention, stack) {
    const rawTitle = intention?.title || prompt.split('.')[0].split('\n')[0];
    const title = this._escapeHtml(rawTitle.substring(0, 70));
    const topic = title.toLowerCase();
    const primary = intention?.style?.colors?.primary || '#3B82F6';
    const secondary = intention?.style?.colors?.secondary || '#1E293B';
    const accent = intention?.style?.colors?.accent || '#10B981';
    const year = new Date().getFullYear();

    const sections = (intention?.sections || ['hero', 'features', 'cta', 'footer']).filter(Boolean);
    const has = (k) => sections.includes(k);

    const headline = title;
    const subheadline = `A melhor experiência em ${topic}. Criado sob medida para você.`;

    let body = '';

    // Navigation
    body += `
<nav class="bg-white shadow-sm sticky top-0 z-50">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex justify-between h-16 items-center">
      <div class="text-xl font-bold" style="color: ${primary}">${title}</div>
      <div class="hidden md:flex space-x-6 text-sm font-medium text-gray-600">
        ${sections.filter(s => s !== 'footer').map(s => `<a href="#${s}" class="hover:text-gray-900 capitalize">${s}</a>`).join('')}
      </div>
    </div>
  </div>
</nav>`;

    // Hero
    body += `
<section id="hero" class="relative overflow-hidden" style="background: linear-gradient(135deg, ${primary}10 0%, ${primary}05 100%)">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
    <div class="text-center">
      <h1 class="text-4xl md:text-6xl font-extrabold text-gray-900 tracking-tight mb-6">${headline}</h1>
      <p class="text-xl text-gray-600 max-w-2xl mx-auto mb-10">${subheadline}</p>
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <button class="px-8 py-4 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all" style="background-color: ${primary}">Quero saber mais</button>
        <button class="px-8 py-4 text-gray-700 font-semibold rounded-lg border-2 border-gray-300 hover:border-gray-400 transition-all">Fale conosco</button>
      </div>
    </div>
  </div>
</section>`;

    // Features
    if (has('features')) {
      const featureTitle = `Por que escolher ${title}?`;
      body += `
<section id="features" class="py-20 bg-white">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="text-center mb-16">
      <h2 class="text-3xl md:text-4xl font-bold text-gray-900 mb-4">${featureTitle}</h2>
      <p class="text-lg text-gray-600 max-w-2xl mx-auto">Tudo o que você precisa para ter sucesso com ${topic}.</p>
    </div>
    <div class="grid md:grid-cols-3 gap-8">
      ${['Qualidade premium', 'Atendimento rápido', 'Preço justo'].map((f, i) => `
      <div class="p-8 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors">
        <div class="w-12 h-12 rounded-lg flex items-center justify-center mb-6 text-white font-bold" style="background-color: ${i === 1 ? accent : primary}">${i + 1}</div>
        <h3 class="text-xl font-semibold text-gray-900 mb-3">${f}</h3>
        <p class="text-gray-600">Oferecemos ${f.toLowerCase()} para garantir que sua experiência com ${topic} seja excepcional.</p>
      </div>`).join('')}
    </div>
  </div>
</section>`;
    }

    // Testimonials
    if (has('testimonials')) {
      body += `
<section id="testimonials" class="py-20 bg-gray-50">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="text-center mb-16">
      <h2 class="text-3xl md:text-4xl font-bold text-gray-900 mb-4">O que nossos clientes dizem</h2>
    </div>
    <div class="grid md:grid-cols-3 gap-8">
      ${['Maria', 'João', 'Ana'].map((name, i) => `
      <div class="p-8 rounded-2xl bg-white shadow-sm">
        <p class="text-gray-600 mb-6">"O ${title} superou minhas expectativas. Recomendo para quem busca qualidade em ${topic}."</p>
        <div class="flex items-center">
          <div class="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold" style="background-color: ${primary}">${name[0]}</div>
          <div class="ml-3">
            <div class="font-semibold text-gray-900">${name}</div>
            <div class="text-sm text-gray-500">Cliente satisfeito</div>
          </div>
        </div>
      </div>`).join('')}
    </div>
  </div>
</section>`;
    }

    // Pricing
    if (has('pricing')) {
      body += `
<section id="pricing" class="py-20 bg-white">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="text-center mb-16">
      <h2 class="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Planos para ${title}</h2>
      <p class="text-lg text-gray-600 max-w-2xl mx-auto">Escolha o plano ideal para o seu momento.</p>
    </div>
    <div class="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
      ${['Básico', 'Profissional', 'Empresarial'].map((plan, i) => `
      <div class="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 ${i === 1 ? 'ring-2' : ''}" style="${i === 1 ? `ring-color: ${primary}` : ''}">
        <h3 class="text-xl font-semibold text-gray-900 mb-2">${plan}</h3>
        <div class="text-4xl font-bold text-gray-900 mb-6">R$${[49, 99, 249][i]}<span class="text-lg text-gray-500 font-normal">/mês</span></div>
        <ul class="space-y-4 mb-8 text-gray-600">
          ${['Acesso completo', 'Suporte por email', 'Relatórios mensais', 'Atendimento prioritário'].slice(0, 2 + i).map(f => `<li class="flex items-center"><svg class="w-5 h-5 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/></svg>${f}</li>`).join('')}
        </ul>
        <button class="w-full py-3 rounded-lg font-semibold transition-all ${i === 1 ? 'text-white' : 'text-gray-700 border-2 border-gray-300'}" style="${i === 1 ? `background-color: ${primary}` : ''}">Escolher ${plan}</button>
      </div>`).join('')}
    </div>
  </div>
</section>`;
    }

    // CTA
    if (has('cta')) {
      body += `
<section id="cta" class="py-20" style="background-color: ${primary}">
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
    <h2 class="text-3xl md:text-4xl font-bold text-white mb-4">Pronto para começar com ${title}?</h2>
    <p class="text-xl text-white/80 mb-10">Entre em contato hoje mesmo e descubra como podemos ajudar.</p>
    <div class="flex flex-col sm:flex-row gap-4 justify-center">
      <button class="px-8 py-4 bg-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all" style="color: ${primary}">Solicitar orçamento</button>
      <button class="px-8 py-4 text-white font-semibold rounded-lg border-2 border-white/30 hover:border-white/50 transition-all">Ver mais</button>
    </div>
  </div>
</section>`;
    }

    // Footer
    body += `
<footer id="footer" class="bg-gray-900 text-white py-16">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="grid md:grid-cols-4 gap-8 mb-12">
      <div>
        <div class="text-2xl font-bold mb-4" style="color: ${primary}">${title}</div>
        <p class="text-gray-400">Sua melhor escolha em ${topic}.</p>
      </div>
      <div>
        <h4 class="font-semibold mb-4">Produto</h4>
        <ul class="space-y-2 text-gray-400">
          <li><a href="#features" class="hover:text-white">Funcionalidades</a></li>
          <li><a href="#pricing" class="hover:text-white">Preços</a></li>
          <li><a href="#" class="hover:text-white">Depoimentos</a></li>
        </ul>
      </div>
      <div>
        <h4 class="font-semibold mb-4">Empresa</h4>
        <ul class="space-y-2 text-gray-400">
          <li><a href="#" class="hover:text-white">Sobre</a></li>
          <li><a href="#" class="hover:text-white">Blog</a></li>
          <li><a href="#" class="hover:text-white">Contato</a></li>
        </ul>
      </div>
      <div>
        <h4 class="font-semibold mb-4">Legal</h4>
        <ul class="space-y-2 text-gray-400">
          <li><a href="#" class="hover:text-white">Privacidade</a></li>
          <li><a href="#" class="hover:text-white">Termos</a></li>
        </ul>
      </div>
    </div>
    <div class="border-t border-gray-800 pt-8 text-center text-gray-500">
      <p>&copy; ${year} ${title}. Todos os direitos reservados.</p>
    </div>
  </div>
</footer>`;

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${subheadline}">
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>body { font-family: 'Inter', sans-serif; }</style>
</head>
<body>
${body}
</body>
</html>`;
  }

  _escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Generate mock HTML for preview
   * @param {string} prompt
   * @param {object} intention
   * @param {string} stack
   * @returns {string}
   */
  generateMockHtml(prompt, intention, stack) {
    const title = intention?.title || 'Landing Page';
    const sections = intention?.sections || ['hero', 'features', 'cta', 'footer'];
    const primary = intention?.style?.colors?.primary || '#3B82F6';

    let html = '';

    // Navigation
    if (sections.length > 2) {
      html += `
<nav class="bg-white shadow-sm sticky top-0 z-50">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex justify-between h-16 items-center">
      <div class="text-2xl font-bold" style="color: ${primary}">${title}</div>
      <div class="hidden md:flex space-x-8">
        ${sections.filter((s) => s !== 'footer').map((s) => `<a href="#${s}" class="text-gray-600 hover:text-gray-900 capitalize">${s}</a>`).join('')}
      </div>
      <button class="md:hidden text-gray-600">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
      </button>
    </div>
  </div>
</nav>`;
    }

    // Generate sections
    for (const section of sections) {
      html += this.generateMockSection(section, title, primary);
    }

    return html;
  }

  /**
   * Generate a mock section HTML
   * @param {string} section
   * @param {string} title
   * @param {string} primary
   * @returns {string}
   */
  generateMockSection(section, title, primary) {
    const sections = {
      hero: `
<section id="hero" class="relative overflow-hidden" style="background: linear-gradient(135deg, ${primary}10 0%, ${primary}05 100%)">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
    <div class="text-center">
      <h1 class="text-4xl md:text-6xl font-extrabold text-gray-900 tracking-tight mb-6">${title}</h1>
      <p class="text-xl text-gray-600 max-w-2xl mx-auto mb-10">A stunning landing page created with NEXO AI. Transform your ideas into reality with our intelligent page generator.</p>
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <button class="px-8 py-4 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all" style="background-color: ${primary}">Get Started</button>
        <button class="px-8 py-4 text-gray-700 font-semibold rounded-lg border-2 border-gray-300 hover:border-gray-400 transition-all">Learn More</button>
      </div>
    </div>
  </div>
</section>`,

      features: `
<section id="features" class="py-20 bg-white">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="text-center mb-16">
      <h2 class="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Powerful Features</h2>
      <p class="text-lg text-gray-600 max-w-2xl mx-auto">Everything you need to create stunning landing pages that convert visitors into customers.</p>
    </div>
    <div class="grid md:grid-cols-3 gap-8">
      ${[1, 2, 3].map((i) => `
      <div class="p-8 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors">
        <div class="w-12 h-12 rounded-lg flex items-center justify-center mb-6" style="background-color: ${primary}20">
          <svg class="w-6 h-6" style="color: ${primary}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
        </div>
        <h3 class="text-xl font-semibold text-gray-900 mb-3">Feature ${i}</h3>
        <p class="text-gray-600">Advanced capability designed to enhance your landing page performance and user engagement.</p>
      </div>`).join('')}
    </div>
  </div>
</section>`,

      pricing: `
<section id="pricing" class="py-20 bg-gray-50">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="text-center mb-16">
      <h2 class="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Simple Pricing</h2>
      <p class="text-lg text-gray-600 max-w-2xl mx-auto">Choose the plan that fits your needs.</p>
    </div>
    <div class="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
      ${['Basic', 'Pro', 'Enterprise'].map((plan, i) => `
      <div class="bg-white rounded-2xl p-8 shadow-lg ${i === 1 ? 'ring-2' : ''}" style="${i === 1 ? `ring-color: ${primary}` : ''}">
        <h3 class="text-xl font-semibold text-gray-900 mb-2">${plan}</h3>
        <div class="text-4xl font-bold text-gray-900 mb-6">$${[29, 79, 199][i]}<span class="text-lg text-gray-500 font-normal">/mo</span></div>
        <ul class="space-y-4 mb-8">
          ${['Unlimited pages', 'AI generation', 'Analytics', 'Priority support'].slice(0, 2 + i).map((f) => `<li class="flex items-center text-gray-600"><svg class="w-5 h-5 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/></svg>${f}</li>`).join('')}
        </ul>
        <button class="w-full py-3 rounded-lg font-semibold transition-all ${i === 1 ? 'text-white' : 'text-gray-700 border-2 border-gray-300'}" style="${i === 1 ? `background-color: ${primary}` : ''}">Get Started</button>
      </div>`).join('')}
    </div>
  </div>
</section>`,

      testimonials: `
<section id="testimonials" class="py-20 bg-white">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="text-center mb-16">
      <h2 class="text-3xl md:text-4xl font-bold text-gray-900 mb-4">What Our Users Say</h2>
    </div>
    <div class="grid md:grid-cols-3 gap-8">
      ${[1, 2, 3].map((i) => `
      <div class="p-8 rounded-2xl bg-gray-50">
        <div class="flex items-center mb-4">
          ${[1, 2, 3, 4, 5].map(() => `<svg class="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>`).join('')}
        </div>
        <p class="text-gray-600 mb-6">"NEXO transformed how we create landing pages. What used to take days now takes minutes. Absolutely incredible tool!"</p>
        <div class="flex items-center">
          <div class="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold" style="background-color: ${primary}">U${i}</div>
          <div class="ml-3">
            <div class="font-semibold text-gray-900">User ${i}</div>
            <div class="text-sm text-gray-500">Company ${i}</div>
          </div>
        </div>
      </div>`).join('')}
    </div>
  </div>
</section>`,

      cta: `
<section id="cta" class="py-20" style="background-color: ${primary}">
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
    <h2 class="text-3xl md:text-4xl font-bold text-white mb-4">Ready to Get Started?</h2>
    <p class="text-xl text-white/80 mb-10">Join thousands of creators who trust NEXO for their landing pages.</p>
    <div class="flex flex-col sm:flex-row gap-4 justify-center">
      <button class="px-8 py-4 bg-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all" style="color: ${primary}">Start Free Trial</button>
      <button class="px-8 py-4 text-white font-semibold rounded-lg border-2 border-white/30 hover:border-white/50 transition-all">Contact Sales</button>
    </div>
  </div>
</section>`,

      footer: `
<footer id="footer" class="bg-gray-900 text-white py-16">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="grid md:grid-cols-4 gap-8 mb-12">
      <div>
        <div class="text-2xl font-bold mb-4" style="color: ${primary}">${title}</div>
        <p class="text-gray-400">Creating stunning landing pages with the power of AI.</p>
      </div>
      <div>
        <h4 class="font-semibold mb-4">Product</h4>
        <ul class="space-y-2 text-gray-400">
          <li><a href="#" class="hover:text-white">Features</a></li>
          <li><a href="#" class="hover:text-white">Pricing</a></li>
          <li><a href="#" class="hover:text-white">Templates</a></li>
        </ul>
      </div>
      <div>
        <h4 class="font-semibold mb-4">Company</h4>
        <ul class="space-y-2 text-gray-400">
          <li><a href="#" class="hover:text-white">About</a></li>
          <li><a href="#" class="hover:text-white">Blog</a></li>
          <li><a href="#" class="hover:text-white">Careers</a></li>
        </ul>
      </div>
      <div>
        <h4 class="font-semibold mb-4">Support</h4>
        <ul class="space-y-2 text-gray-400">
          <li><a href="#" class="hover:text-white">Help Center</a></li>
          <li><a href="#" class="hover:text-white">Contact</a></li>
          <li><a href="#" class="hover:text-white">Privacy</a></li>
        </ul>
      </div>
    </div>
    <div class="border-t border-gray-800 pt-8 text-center text-gray-500">
      <p>&copy; ${new Date().getFullYear()} ${title}. All rights reserved.</p>
    </div>
  </div>
</footer>`,
    };

    return sections[section] || `
<section id="${section}" class="py-20 bg-white">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <h2 class="text-3xl font-bold text-gray-900 text-center capitalize mb-8">${section}</h2>
    <p class="text-gray-600 text-center max-w-2xl mx-auto">This is the ${section} section of your landing page.</p>
  </div>
</section>`;
  }

  /**
   * Normalize a review result so passed=false whenever critical/error issues exist
   * or the local bug detector rejects the HTML.
   * @param {object} review
   * @param {string} html
   */
  normalizeReviewResult(review, html) {
    if (!review || typeof review !== 'object') {
      return;
    }

    const hasCriticalOrError = (review.issues || []).some(
      (issue) => issue.severity === 'critical' || issue.severity === 'error'
    );

    if (review.score < 90 || hasCriticalOrError) {
      review.passed = false;
    }
  }

  /**
   * Get human-readable phase messages
   * @param {string} phase
   * @param {string} state - start or end
   * @returns {string}
   */
  getPhaseMessage(phase, state) {
    const messages = {
      intention: { start: 'Analyzing your requirements...', end: 'Requirements analyzed' },
      structure: { start: 'Designing page structure...', end: 'Page structure designed' },
      code: { start: 'Generating code...', end: 'Code generated' },
      review: { start: 'Reviewing code quality...', end: 'Code review complete' },
      preview: { start: 'Building preview...', end: 'Preview ready' },
      deploy: { start: 'Preparing deployment...', end: 'Ready for deployment' },
    };
    return messages[phase]?.[state] || `${phase} ${state}ed`;
  }

  /**
   * Extract the best review-like JSON object from a string.
   * Delegates to ResponseParser.
   * @param {string} str
   * @returns {object|null}
   */
  extractJsonObject(str) {
    return ResponseParser.extractJsonObject(str);
  }

  /**
   * Normalize a parsed review-like object into a consistent shape.
   * Delegates to ResponseParser.
   * @param {object} parsed
   * @returns {object|null}
   */
  normalizeReviewShape(parsed) {
    return ResponseParser.normalizeReviewShape(parsed);
  }

  /**
   * Safely parse JSON, return fallback on error.
   * @param {string} str
   * @param {object} fallback
   * @returns {object}
   */
  safeJsonParse(str, fallback) {
    const parsed = ResponseParser.extractJsonObject(str);
    if (parsed !== null) {
      return parsed;
    }
    return fallback;
  }

  /**
   * Parse a review-phase response using the real ResponseParser.
   * No local bug-detector fallbacks: if Kimi returns an empty or malformed
   * review, we throw ReviewValidationError so the caller can retry with a
   * stricter prompt.
   * @param {string} content - Raw Kimi response
   * @param {string} html - Current HTML being reviewed
   * @param {string} sessionId - For logging
   * @returns {object} Review object
   */
  parseReviewResponse(content, html, sessionId) {
    try {
      const review = ResponseParser.extractReviewFromResponse(content);
      console.log(
        `[GenerationService][${sessionId}] Parsed review JSON with ${review.issues.length} issue(s), score=${review.score}, passed=${review.passed}`
      );
      return review;
    } catch (err) {
      console.warn(
        `[GenerationService][${sessionId}] Review parse failed: ${err.reason || err.message}. Raw response (${(content || '').length} chars): ${String(content || '').slice(0, 2000).replace(/\n/g, ' ')}`
      );
      throw err;
    }
  }

  /**
   * Extract HTML from AI response.
   * Delegates to ResponseParser.
   * @param {string} response
   * @returns {string}
   */
  extractHtmlFromResponse(response) {
    return ResponseParser.extractHtmlFromResponse(response);
  }

  /**
   * Extract fix instructions from review result.
   * Prioritizes rebuildInstructions.specificFixes, falls back to issues[].fix.
   * @param {object} review
   * @returns {string[]}
   */
  extractFixInstructions(review) {
    if (!review || typeof review !== "object") {
      return [];
    }
    
    // Priority 1: rebuildInstructions.specificFixes (from QA agent 04-qa.md)
    const specificFixes = review.metadata?.rebuildInstructions?.specificFixes ||
                        review.rebuildInstructions?.specificFixes ||
                        [];
    if (Array.isArray(specificFixes) && specificFixes.length > 0) {
      return specificFixes.filter(f => typeof f === "string" && f.trim().length > 0);
    }
    
    // Priority 2: issues[].fix (from review dimensions), fallback to issues[].message
    const allIssues = review.issues || [];
    const issueFixes = allIssues
      .filter(issue => {
        const text = issue.fix || issue.message;
        return text && typeof text === "string" && text.trim().length > 0;
      })
      .map(issue => `[${issue.severity?.toUpperCase() || "FIX"}] ${issue.fix || issue.message}`);
    
    if (issueFixes.length > 0) {
      return issueFixes;
    }
    
    // Priority 3: suggestions
    const suggestions = review.suggestions || [];
    if (Array.isArray(suggestions) && suggestions.length > 0) {
      return suggestions.filter(s => typeof s === "string" && s.trim().length > 0);
    }
    
    return [];
  }
}

module.exports = new GenerationService();
module.exports.registerEventStream = registerEventStream;
module.exports.unregisterEventStream = unregisterEventStream;
module.exports.closeAllStreams = closeAllStreams;
module.exports.emitGenerationEvent = emitGenerationEvent;
module.exports.PHASE_PROMPTS = PHASE_PROMPTS;
