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
const AppSettingsRepository = require('../models/repositories/AppSettingsRepository');
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
const adminEventBus = require('./adminEventBus');

// Store active SSE connections by sessionId
const eventStreams = new Map();

/**
 * Compose the final prompt sent to the generation pipeline.
 * Prepends the selected mode base prompt and appends the global base prompt.
 * @param {string} prompt - raw user prompt
 * @param {object} options - generation options
 * @param {object} settings - app settings object
 * @returns {string}
 */
function composeGenerationPrompt(prompt, options, settings) {
  const modes = settings['generation.modes'] || [];
  const selectedMode = options.generationMode || settings['generation.mode'] || 'landing';
  const mode = modes.find((m) => m.label.toLowerCase() === selectedMode.toLowerCase()) || {};
  const basePrompt = settings['generation.base_prompt'] || '';
  return [mode.basePrompt, prompt, basePrompt].filter(Boolean).join('\n\n');
}

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
  if (res) {
    try {
      // Send all events as the default 'message' type so the frontend's
      // EventSource.onmessage receives them without per-type listeners.
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch (error) {
      console.error(`[GenerationService] Failed to emit event for session ${sessionId}:`, error.message);
      unregisterEventStream(sessionId);
    }
  }

  // Also forward to the admin live event bus (even when no per-session listener is connected)
  adminEventBus.publish({ ...event, scope: 'generation' });
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

      // Resolve generation mode and compose the full prompt
      const settings = await AppSettingsRepository.getAll();
      const selectedMode = options.generationMode || settings['generation.mode'] || 'landing';
      const fullPrompt = composeGenerationPrompt(prompt, options, settings);

      // Store generation context
      const context = BridgeAdapter.initializeContext(sessionId, persistedBridge);
      context.stack = stack || config.stacks.default;
      context.prompt = prompt;
      context.generationMode = selectedMode;
      context.options = options;
      generationContexts.set(sessionId, context);

      // Run generation phases (always real Kimi bridge — mock mode removed)
      await this.runRealGeneration(sessionId, fullPrompt, stack, options);
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
          // Start a fresh Kimi chat for code so Kimi is not stuck in brief/JSON-mode
          // from the previous intention/structure messages.
          response = await this.runCodePhaseWithContinue(sessionId, context, phasePrompt, selectedStack, phaseTimeoutMs, true);
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
          case 'intention': {
            const parsed = ResponseParser.extractGenericJson(content);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
              throw new Error('Intention phase did not return a valid JSON object');
            }
            context.intention = parsed;
            break;
          }
          case 'structure': {
            const parsed = ResponseParser.extractGenericJson(content);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
              throw new Error('Structure phase did not return a valid JSON object');
            }
            context.structure = parsed;
            break;
          }
          case 'code':
            currentHtml = this.extractHtmlFromResponse(content);

            // No local fallback: if Kimi did not produce valid HTML, fail loudly.
            if (!hasRealCode(currentHtml) || !/<\/html\s*>/i.test(currentHtml)) {
              throw new Error('Code phase did not produce a valid HTML document');
            }

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
          recoverable: false,
        });

        // No mock/local fallbacks: if any generation phase fails, surface the
        // error to the user instead of delivering a fake page.
        throw error;
      }
    }

    // If review failed, attempt to rebuild and re-review the code.
    // Skip the rebuild loop when the review itself could not be parsed — the
    // HTML is already complete and we should publish it as unreviewed instead
    // of asking Kimi to "fix" a parse error.
    if (context.review && !context.review.passed && !context.review.metadata?.reviewParseFailed) {
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

    // No local fallback: if we still don't have real HTML after all retries,
    // fail the generation instead of serving a fake page.
    if (!hasRealCode(currentHtml) || !/<\/html\s*>/i.test(currentHtml)) {
      throw new Error('Generation did not produce a valid HTML document');
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
        // Keep the ongoing chat context (structure → code); do NOT start a new chat here.
        newChat: false,
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
module.exports.composeGenerationPrompt = composeGenerationPrompt;
