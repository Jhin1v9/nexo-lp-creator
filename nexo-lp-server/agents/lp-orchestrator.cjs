/**
 * NEXO Landing Page Creator v3.0 - Orchestrator
 *
 * Wraps the luna-soul pattern with isolated context for LP creation.
 * Coordinates the agent pipeline: intention, structure, code, review,
 * preview, and deploy phases.
 *
 * This orchestrator manages the full lifecycle of landing page generation,
 * delegating to specialized agents while maintaining isolated context.
 *
 * @module agents/lp-orchestrator
 * @version 3.0.0
 */

const crypto = require('crypto');

/**
 * Create an isolated context for a landing page creation session
 * @param {string} sessionId
 * @param {object} input
 * @returns {object}
 */
function createContext(sessionId, input = {}) {
  return {
    sessionId,
    userId: generateIsolatedUserId(),
    startTime: Date.now(),
    phase: null,
    input: {
      prompt: input.prompt || '',
      stack: input.stack || 'react-tailwind',
      options: input.options || {},
    },
    memory: {},
    state: 'initialized',
    errors: [],
    metadata: {
      version: '3.0.0',
      createdAt: new Date().toISOString(),
    },
  };
}

/**
 * Generate an isolated user ID for bridge context
 * Format: nlp-{timestamp}-{hash}
 * @returns {string}
 */
function generateIsolatedUserId() {
  const timestamp = Date.now();
  const hash = crypto.randomBytes(4).toString('hex');
  return `nlp-${timestamp}-${hash}`;
}

/**
 * Phase definitions with their configuration
 */
const PHASES = {
  intention: {
    name: 'intention',
    description: 'Understand user requirements and extract LP specifications',
    agent: 'intention-agent',
    timeout: 30000,
    retries: 2,
  },
  structure: {
    name: 'structure',
    description: 'Design page structure and component hierarchy',
    agent: 'structure-agent',
    timeout: 30000,
    retries: 2,
  },
  code: {
    name: 'code',
    description: 'Generate HTML/CSS/JS code for the landing page',
    agent: 'code-agent',
    timeout: 60000,
    retries: 2,
  },
  review: {
    name: 'review',
    description: 'Quality check the generated code',
    agent: 'review-agent',
    timeout: 30000,
    retries: 1,
  },
  preview: {
    name: 'preview',
    description: 'Prepare and serve the preview',
    agent: 'preview-agent',
    timeout: 15000,
    retries: 1,
  },
  deploy: {
    name: 'deploy',
    description: 'Handle deployment to GitHub Pages or ZIP',
    agent: 'deploy-agent',
    timeout: 45000,
    retries: 1,
    optional: true,
  },
};

/**
 * Event factory for standardized events
 * @param {string} type
 * @param {string} phase
 * @param {object} data
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
 * Orchestrator class - manages the full agent pipeline
 */
class Orchestrator {
  constructor() {
    this.phases = Object.keys(PHASES);
    this.activeContexts = new Map();
  }

  /**
   * Run the full orchestration pipeline
   * @param {string} sessionId
   * @param {object} input - { prompt, stack, options, shouldDeploy }
   * @param {Function} onEvent - Event callback for each phase
   * @returns {object} Final context with all results
   */
  async run(sessionId, input, onEvent) {
    // Create isolated context
    const context = createContext(sessionId, input);
    this.activeContexts.set(sessionId, context);

    const emit = (type, phase, data) => {
      const event = createEvent(type, phase, { sessionId, ...data });
      if (onEvent) onEvent(event);
      return event;
    };

    try {
      emit('action_start', 'orchestration', { message: 'Starting landing page creation pipeline' });
      context.state = 'running';

      // Execute each phase sequentially
      for (const phaseKey of this.phases) {
        const phaseConfig = PHASES[phaseKey];

        // Skip optional deploy phase if not requested
        if (phaseConfig.optional && !input.shouldDeploy) {
          continue;
        }

        context.phase = phaseKey;

        // Emit phase start
        emit('action_start', phaseKey, {
          message: phaseConfig.description,
          agent: phaseConfig.agent,
        });

        try {
          // Execute the phase
          const result = await this.executePhase(context, phaseKey, emit);

          // Store result in context memory
          context.memory[phaseKey] = result;

          // Emit phase completion
          emit('action_end', phaseKey, {
            message: `${phaseConfig.description} - completed`,
            agent: phaseConfig.agent,
            status: 'success',
            result: this.summarizeResult(phaseKey, result),
          });
        } catch (phaseError) {
          // Attempt recovery
          const recovered = await this.handlePhaseError(context, phaseKey, phaseError, emit);

          if (!recovered) {
            context.errors.push({
              phase: phaseKey,
              error: phaseError.message,
              timestamp: new Date().toISOString(),
            });

            emit('action_error', phaseKey, {
              error: phaseError.message,
              recoverable: false,
            });

            // For critical phases, stop the pipeline
            if (['intention', 'code'].includes(phaseKey)) {
              throw phaseError;
            }
          }
        }
      }

      context.state = 'completed';
      emit('action_end', 'orchestration', {
        message: 'Landing page creation pipeline completed',
        completed: true,
        phasesCompleted: Object.keys(context.memory),
      });

      return context;
    } catch (error) {
      context.state = 'failed';
      emit('action_error', 'orchestration', {
        error: error.message,
        phase: context.phase,
      });

      throw error;
    } finally {
      // Cleanup
      this.activeContexts.delete(sessionId);
    }
  }

  /**
   * Execute a single phase
   * @param {object} context
   * @param {string} phaseKey
   * @param {Function} emit
   * @returns {object} Phase result
   */
  async executePhase(context, phaseKey, emit) {
    const phaseConfig = PHASES[phaseKey];

    // This is where actual agent execution would happen
    // For now, delegate to the generation service which handles the real work
    const GenerationService = require('../services/lpGenerationService');
    const SessionService = require('../services/lpSessionService');
    const BridgeAdapter = require('../services/lpBridgeAdapter.cjs');

    // Update session status
    await SessionService.updateStatus(context.sessionId, phaseKey);

    switch (phaseKey) {
      case 'intention': {
        // Use bridge adapter to analyze requirements
        const bridgeContext = BridgeAdapter.initializeContext(context.sessionId);
        const prompt = `Analyze this landing page request: "${context.input.prompt}"
Return structured requirements as JSON with: title, description, sections, style, target.`;

        try {
          const response = await BridgeAdapter.sendMessage(bridgeContext, prompt, {
            stack: context.input.stack,
          });
          return this.parseIntentionResult(response.content);
        } catch {
          // Fallback to basic extraction
          return this.extractBasicIntention(context.input.prompt);
        }
      }

      case 'structure': {
        const intention = context.memory.intention || {};
        const sections = intention.sections || ['hero', 'features', 'cta', 'footer'];

        return {
          layout: 'single-page',
          sections: sections.map((s, i) => ({
            id: s,
            type: `${s}-section`,
            components: this.getDefaultComponents(s),
            order: i + 1,
          })),
          navigation: sections.length > 2,
          responsive_breakpoints: ['mobile', 'tablet', 'desktop'],
        };
      }

      case 'code': {
        // Code generation is handled by the generation service
        // The HTML is already stored in the session by lpGenerationService
        const session = await SessionService.getSessionById(context.sessionId);
        return {
          stack: context.input.stack,
          hasHtml: !!session?.generatedHtml,
          htmlLength: session?.generatedHtml?.length || 0,
        };
      }

      case 'review': {
        const BugDetectorService = require('../services/lpBugDetectorService');
        const report = await BugDetectorService.detect(context.sessionId);
        return report;
      }

      case 'preview': {
        const PreviewService = require('../services/lpPreviewService');
        const preview = await PreviewService.getPreview(context.sessionId);
        return {
          previewUrl: preview?.previewUrl || null,
          ready: preview !== null,
        };
      }

      case 'deploy': {
        return {
          ready: true,
          targets: ['github-pages', 'zip-download'],
        };
      }

      default:
        return { phase: phaseKey, completed: true };
    }
  }

  /**
   * Handle phase errors with recovery strategies
   * @param {object} context
   * @param {string} phaseKey
   * @param {Error} error
   * @param {Function} emit
   * @returns {boolean} Whether recovery succeeded
   */
  async handlePhaseError(context, phaseKey, error, emit) {
    const phaseConfig = PHASES[phaseKey];

    // Log the error
    console.error(`[Orchestrator] Phase ${phaseKey} error:`, error.message);

    // Recovery strategies
    const recoveryStrategies = {
      timeout: async () => {
        emit('action_start', phaseKey, { message: `Retrying ${phaseConfig.description} (timeout recovery)...` });
        await this.sleep(2000);
        try {
          const result = await this.executePhase(context, phaseKey, emit);
          context.memory[phaseKey] = result;
          return true;
        } catch {
          return false;
        }
      },
      fallback: async () => {
        // Use fallback/mock data
        context.memory[phaseKey] = this.getFallbackResult(phaseKey, context);
        emit('action_end', phaseKey, {
          message: `${phaseConfig.description} - completed with fallback`,
          status: 'partial',
        });
        return true;
      },
    };

    // Try timeout recovery first, then fallback
    if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
      const recovered = await recoveryStrategies.timeout();
      if (recovered) return true;
    }

    // Use fallback for non-critical phases
    if (!['intention', 'code'].includes(phaseKey)) {
      return await recoveryStrategies.fallback();
    }

    return false;
  }

  /**
   * Get fallback result for a phase
   * @param {string} phaseKey
   * @param {object} context
   * @returns {object}
   */
  getFallbackResult(phaseKey, context) {
    const fallbacks = {
      intention: this.extractBasicIntention(context.input.prompt),
      structure: {
        layout: 'single-page',
        sections: [
          { id: 'hero', type: 'hero-section', components: ['heading', 'subheading', 'cta'], order: 1 },
          { id: 'features', type: 'features-section', components: ['feature-cards'], order: 2 },
          { id: 'cta', type: 'cta-section', components: ['heading', 'button'], order: 3 },
          { id: 'footer', type: 'footer-section', components: ['links', 'copyright'], order: 4 },
        ],
        navigation: true,
        responsive_breakpoints: ['mobile', 'tablet', 'desktop'],
      },
      review: { score: 75, passed: true, issues: [] },
      preview: { previewUrl: null, ready: false },
      deploy: { ready: true, targets: ['zip-download'] },
    };

    return fallbacks[phaseKey] || { completed: true, fallback: true };
  }

  /**
   * Parse intention result from AI response
   * @param {string} content
   * @returns {object}
   */
  parseIntentionResult(content) {
    try {
      // Try to extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Fall through to basic extraction
    }
    return this.extractBasicIntention(content);
  }

  /**
   * Extract basic intention from prompt text
   * @param {string} prompt
   * @returns {object}
   */
  extractBasicIntention(prompt) {
    const lower = prompt.toLowerCase();
    const sections = [];

    if (lower.includes('product') || lower.includes('saas')) {
      sections.push('hero', 'features', 'pricing', 'testimonials', 'cta');
    } else if (lower.includes('portfolio')) {
      sections.push('hero', 'about', 'gallery', 'contact');
    } else if (lower.includes('event')) {
      sections.push('hero', 'details', 'schedule', 'speakers', 'register');
    } else {
      sections.push('hero', 'features', 'cta', 'footer');
    }

    return {
      title: prompt.split('.')[0].substring(0, 60) || 'Landing Page',
      description: prompt.substring(0, 200),
      sections: [...new Set(sections)],
      style: {
        tone: 'modern',
        colors: { primary: '#3B82F6', secondary: '#1E293B' },
        typography: 'modern',
      },
      target: {
        audience: 'general',
        purpose: 'branding',
      },
    };
  }

  /**
   * Get default components for a section type
   * @param {string} section
   * @returns {string[]}
   */
  getDefaultComponents(section) {
    const defaults = {
      hero: ['heading', 'subheading', 'cta-button', 'hero-image'],
      features: ['feature-grid', 'feature-cards'],
      pricing: ['pricing-cards', 'toggle'],
      testimonials: ['testimonial-cards', 'ratings'],
      cta: ['heading', 'subheading', 'cta-button'],
      footer: ['logo', 'links', 'social', 'copyright'],
      about: ['heading', 'paragraph', 'image'],
      gallery: ['image-grid'],
      contact: ['form', 'info-cards'],
      team: ['team-cards'],
      details: ['info-cards'],
      schedule: ['timeline'],
      register: ['form', 'benefits'],
    };
    return defaults[section] || ['heading', 'content'];
  }

  /**
   * Summarize a phase result for event emission
   * @param {string} phase
   * @param {object} result
   * @returns {object}
   */
  summarizeResult(phase, result) {
    const summaries = {
      intention: { sections: result.sections, title: result.title },
      structure: { sectionCount: result.sections?.length, hasNavigation: result.navigation },
      code: { stack: result.stack, hasHtml: result.hasHtml, htmlLength: result.htmlLength },
      review: { score: result.score, passed: result.passed, issueCount: result.summary?.totalIssues },
      preview: { previewUrl: result.previewUrl, ready: result.ready },
      deploy: { targets: result.targets },
    };

    return summaries[phase] || { completed: true };
  }

  /**
   * Get an active context by session ID
   * @param {string} sessionId
   * @returns {object|undefined}
   */
  getContext(sessionId) {
    return this.activeContexts.get(sessionId);
  }

  /**
   * Cancel an active orchestration
   * @param {string} sessionId
   */
  cancel(sessionId) {
    const context = this.activeContexts.get(sessionId);
    if (context) {
      context.state = 'cancelled';
      this.activeContexts.delete(sessionId);
    }
  }

  /**
   * Sleep utility
   * @param {number} ms
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton
const orchestrator = new Orchestrator();

module.exports = {
  Orchestrator,
  orchestrator,
  createContext,
  generateIsolatedUserId,
  createEvent,
  PHASES,
};
