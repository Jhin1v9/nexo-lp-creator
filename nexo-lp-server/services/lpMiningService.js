/**
 * NEXO Landing Page Creator v3.0 - Mining Service
 *
 * Template mining pipeline that scrapes landing pages from URLs
 * and extracts reusable components, patterns, and templates.
 *
 * @module services/lpMiningService
 * @version 3.0.0
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const MiningJobRepository = require('../models/repositories/MiningJobRepository');
const TemplateRepository = require('../models/repositories/TemplateRepository');
const config = require('../config/nexo-lp-config');

class MiningService {
  constructor() {
    this.enabled = config.mining.enabled !== false;
    this.outputPath = config.mining.outputPath;
    this.maxConcurrent = config.mining.maxConcurrent || 3;
    this.requestTimeout = config.mining.requestTimeout || 30000;
    this.userAgent = config.mining.userAgent || 'NEXO-LP-Creator/3.0';
    this.queue = [];
    this.activeJobs = 0;
  }

  /**
   * Submit a URL for template mining
   * @param {string} url
   * @param {string} userId
   * @returns {object} { jobId, status, queuePosition }
   */
  async submitUrl(url, userId) {
    if (!this.enabled) {
      return { success: false, error: 'Template mining is disabled' };
    }

    if (!url) {
      throw new Error('URL is required');
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      throw new Error('Invalid URL format');
    }

    // Get queue position
    const pendingCount = await MiningJobRepository.getPendingCount();
    const queuePosition = pendingCount + 1;

    // Create mining job record
    const job = await MiningJobRepository.create({
      url,
      user_id: userId,
      queue_position: queuePosition,
    });

    // Add to processing queue
    this.queue.push(job.id);

    // Try to process immediately if capacity allows
    this.processQueue();

    return {
      success: true,
      jobId: job.id,
      status: job.status,
      queuePosition,
      message: queuePosition > 1 ? `Queued at position ${queuePosition}` : 'Processing started',
    };
  }

  /**
   * Get mining job status
   * @param {string} jobId
   * @returns {object|null}
   */
  async getJobStatus(jobId) {
    if (!jobId) {
      throw new Error('Job ID is required');
    }

    const job = await MiningJobRepository.findById(jobId);
    if (!job) {
      return null;
    }

    // Calculate estimated time remaining
    let estimatedSeconds = null;
    if (job.status === 'pending' || job.status === 'queued') {
      estimatedSeconds = job.queue_position ? job.queue_position * 30 : 30;
    } else if (['scraping', 'analyzing', 'extracting'].includes(job.status)) {
      estimatedSeconds = Math.round((100 - job.progress) / 10) * 5;
    }

    return {
      jobId: job.id,
      url: job.url,
      status: job.status,
      progress: job.progress,
      queuePosition: job.queue_position,
      estimatedSeconds,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      createdAt: job.created_at,
    };
  }

  /**
   * Get completed job result
   * @param {string} jobId
   * @returns {object|null}
   */
  async getJobResult(jobId) {
    const job = await MiningJobRepository.findById(jobId);
    if (!job || job.status !== 'completed') {
      return null;
    }

    return {
      jobId: job.id,
      url: job.url,
      status: job.status,
      result: job.result ? JSON.parse(job.result) : null,
      completedAt: job.completed_at,
    };
  }

  /**
   * Process the mining queue
   */
  async processQueue() {
    if (this.activeJobs >= this.maxConcurrent) {
      return;
    }

    while (this.queue.length > 0 && this.activeJobs < this.maxConcurrent) {
      const jobId = this.queue.shift();
      if (!jobId) continue;

      const job = await MiningJobRepository.findById(jobId);
      if (!job || job.status !== 'pending') {
        continue;
      }

      this.activeJobs++;
      await MiningJobRepository.updateStatus(jobId, 'queued');

      // Process job asynchronously
      this.processJob(jobId).finally(() => {
        this.activeJobs--;
        // Process more jobs if available
        setTimeout(() => this.processQueue(), 100);
      });
    }
  }

  /**
   * Process a single mining job
   * @param {string} jobId
   */
  async processJob(jobId) {
    const job = await MiningJobRepository.findById(jobId);
    if (!job) return;

    try {
      // Phase 1: Scraping
      await MiningJobRepository.updateStatus(jobId, 'scraping');
      await MiningJobRepository.updateProgress(jobId, 10);

      const html = await this.scrapeUrl(job.url);

      if (!html || html.trim().length === 0) {
        throw new Error('Failed to retrieve content from URL');
      }

      await MiningJobRepository.updateProgress(jobId, 40);

      // Phase 2: Analysis
      await MiningJobRepository.updateStatus(jobId, 'analyzing');

      const analysis = this.analyzeHtml(html);
      await MiningJobRepository.updateProgress(jobId, 70);

      // Phase 3: Extraction
      await MiningJobRepository.updateStatus(jobId, 'extracting');

      const extracted = this.extractComponents(html, analysis);
      await MiningJobRepository.updateProgress(jobId, 90);

      // Save result
      const result = {
        url: job.url,
        title: analysis.title,
        description: analysis.description,
        sections: analysis.sections,
        components: extracted.components,
        colorPalette: analysis.colorPalette,
        typography: analysis.typography,
        techStack: analysis.techStack,
        extractedAt: new Date().toISOString(),
      };

      // Save to file
      await this.saveMinedTemplate(jobId, result);

      // Create template from mined data
      const template = await this.createTemplateFromMining(jobId, result);

      await MiningJobRepository.updateProgress(jobId, 100);
      await MiningJobRepository.updateResult(jobId, { ...result, templateId: template?.id });

      console.log(`[MiningService] Job ${jobId} completed successfully`);
    } catch (error) {
      console.error(`[MiningService] Job ${jobId} failed:`, error.message);
      await MiningJobRepository.updateError(jobId, error.message);
    }
  }

  /**
   * Scrape HTML from a URL
   * @param {string} url
   * @returns {string}
   */
  async scrapeUrl(url) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(this.requestTimeout),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) {
        console.warn(`[MiningService] Content-Type is not HTML: ${contentType}`);
      }

      return await response.text();
    } catch (error) {
      throw new Error(`Failed to scrape URL: ${error.message}`);
    }
  }

  /**
   * Analyze scraped HTML
   * @param {string} html
   * @returns {object}
   */
  analyzeHtml(html) {
    const lower = html.toLowerCase();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';

    // Extract meta description
    const descMatch = html.match(/<meta[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["']([^"']*)["'][^>]*>/i) ||
                       html.match(/<meta[^>]*content\s*=\s*["']([^"']*)["'][^>]*name\s*=\s*["']description["'][^>]*>/i);
    const description = descMatch ? descMatch[1].trim() : '';

    // Detect sections
    const sections = this.detectSections(html);

    // Extract color palette
    const colorPalette = this.extractColorPalette(html);

    // Detect typography
    const typography = this.detectTypography(html);

    // Detect tech stack
    const techStack = this.detectTechStack(html);

    return {
      title,
      description,
      sections,
      colorPalette,
      typography,
      techStack,
    };
  }

  /**
   * Detect page sections from HTML
   * @param {string} html
   * @returns {string[]}
   */
  detectSections(html) {
    const sections = [];
    const lower = html.toLowerCase();

    const sectionPatterns = [
      { name: 'hero', patterns: ['hero', 'banner', 'jumbotron'] },
      { name: 'navigation', patterns: ['nav', 'navbar', 'menu', 'header'] },
      { name: 'features', patterns: ['feature', 'features', 'benefits', 'services'] },
      { name: 'pricing', patterns: ['pricing', 'price', 'plan', 'plans'] },
      { name: 'testimonials', patterns: ['testimonial', 'review', 'feedback', 'quote'] },
      { name: 'faq', patterns: ['faq', 'frequently', 'question'] },
      { name: 'cta', patterns: ['cta', 'call-to-action', 'signup', 'subscribe'] },
      { name: 'footer', patterns: ['footer'] },
      { name: 'team', patterns: ['team', 'about', 'staff'] },
      { name: 'contact', patterns: ['contact', 'form', 'reach'] },
      { name: 'gallery', patterns: ['gallery', 'portfolio', 'showcase'] },
      { name: 'stats', patterns: ['stat', 'counter', 'metric', 'numbers'] },
    ];

    for (const section of sectionPatterns) {
      for (const pattern of section.patterns) {
        if (lower.includes(pattern)) {
          sections.push(section.name);
          break;
        }
      }
    }

    // Also check for semantic HTML section tags
    const semanticSections = html.match(/<section[^>]*id\s*=\s*["']([^"']+)["'][^>]*>/gi) || [];
    for (const match of semanticSections) {
      const idMatch = match.match(/id\s*=\s*["']([^"']+)["']/i);
      if (idMatch) {
        const sectionName = idMatch[1].toLowerCase();
        if (!sections.includes(sectionName)) {
          sections.push(sectionName);
        }
      }
    }

    return [...new Set(sections)];
  }

  /**
   * Extract color palette from HTML/CSS
   * @param {string} html
   * @returns {string[]}
   */
  extractColorPalette(html) {
    const colors = new Set();

    // Match hex colors
    const hexColors = html.match(/#[0-9a-fA-F]{3,8}/g) || [];
    hexColors.forEach((c) => colors.add(c.toLowerCase()));

    // Match rgb/rgba colors
    const rgbColors = html.match(/rgba?\s*\([^)]*\)/g) || [];
    rgbColors.forEach((c) => colors.add(c.toLowerCase()));

    // Match Tailwind color classes
    const tailwindColors = html.match(/\b(bg|text|border)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g) || [];
    tailwindColors.forEach((c) => colors.add(c));

    return [...colors].slice(0, 20);
  }

  /**
   * Detect typography from HTML
   * @param {string} html
   * @returns {object}
   */
  detectTypography(html) {
    const fonts = new Set();
    const fontMatch = html.match(/font-family\s*:\s*([^;]+)/gi) || [];
    fontMatch.forEach((f) => {
      const family = f.replace(/font-family\s*:\s*/, '').trim();
      fonts.add(family);
    });

    // Check Google Fonts
    const googleFonts = html.match(/fonts\.googleapis\.com[^"']*family=([^&"']+)/g) || [];
    googleFonts.forEach((f) => {
      const families = f.split('|');
      families.forEach((fam) => fonts.add(fam.replace(/:.+$/, '')));
    });

    return {
      fonts: [...fonts],
      hasGoogleFonts: googleFonts.length > 0,
    };
  }

  /**
   * Detect technology stack
   * @param {string} html
   * @returns {string[]}
   */
  detectTechStack(html) {
    const stack = [];
    const lower = html.toLowerCase();

    if (lower.includes('react') || lower.includes('__react')) stack.push('react');
    if (lower.includes('vue') || lower.includes('__vue')) stack.push('vue');
    if (lower.includes('angular')) stack.push('angular');
    if (lower.includes('next.js') || lower.includes('_next')) stack.push('nextjs');
    if (lower.includes('tailwindcss') || lower.includes('tailwind')) stack.push('tailwindcss');
    if (lower.includes('bootstrap')) stack.push('bootstrap');
    if (lower.includes('jquery')) stack.push('jquery');
    if (lower.includes('gsap')) stack.push('gsap');
    if (html.includes('cdn.tailwindcss.com')) stack.push('tailwindcdn');

    if (stack.length === 0) {
      stack.push('html-css');
    }

    return stack;
  }

  /**
   * Extract components from HTML
   * @param {string} html
   * @param {object} analysis
   * @returns {object}
   */
  extractComponents(html, analysis) {
    const components = [];

    // Extract hero section
    const heroSection = this.extractSection(html, ['hero', 'banner', 'jumbotron']);
    if (heroSection) {
      components.push({ type: 'hero', html: heroSection });
    }

    // Extract CTA section
    const ctaSection = this.extractSection(html, ['cta', 'call-to-action', 'signup']);
    if (ctaSection) {
      components.push({ type: 'cta', html: ctaSection });
    }

    // Extract feature cards
    const featureCards = this.extractFeatureCards(html);
    if (featureCards.length > 0) {
      components.push({ type: 'features', cards: featureCards });
    }

    // Extract navigation
    const nav = this.extractSection(html, ['nav', 'navbar', 'header']);
    if (nav) {
      components.push({ type: 'navigation', html: nav });
    }

    // Extract footer
    const footer = this.extractSection(html, ['footer']);
    if (footer) {
      components.push({ type: 'footer', html: footer });
    }

    return { components, count: components.length };
  }

  /**
   * Extract a specific section from HTML
   * @param {string} html
   * @param {string[]} identifiers
   * @returns {string|null}
   */
  extractSection(html, identifiers) {
    for (const id of identifiers) {
      // Try by ID
      const byId = new RegExp(`<(section|div|header|footer|nav)[^>]*id\s*=\s*["'][^"']*${id}[^"']*["'][^>]*>`, 'i');
      const idMatch = html.match(byId);
      if (idMatch) {
        const startIndex = idMatch.index;
        const endTag = `</${idMatch[1]}>`;
        let depth = 1;
        let endIndex = startIndex + idMatch[0].length;

        while (depth > 0 && endIndex < html.length) {
          const nextOpen = html.indexOf(`<${idMatch[1]}`, endIndex);
          const nextClose = html.indexOf(endTag, endIndex);

          if (nextClose === -1) break;
          if (nextOpen !== -1 && nextOpen < nextClose) {
            depth++;
            endIndex = nextOpen + 1;
          } else {
            depth--;
            endIndex = nextClose + endTag.length;
          }
        }

        return html.substring(startIndex, endIndex);
      }

      // Try by class
      const byClass = new RegExp(`<(section|div|header|footer|nav)[^>]*class\s*=\s*["'][^"']*${id}[^"']*["'][^>]*>`, 'i');
      const classMatch = html.match(byClass);
      if (classMatch) {
        const startIndex = classMatch.index;
        const tag = classMatch[1];
        const endTag = `</${tag}>`;
        let depth = 1;
        let endIndex = startIndex + classMatch[0].length;

        while (depth > 0 && endIndex < html.length) {
          const nextOpen = html.indexOf(`<${tag}`, endIndex);
          const nextClose = html.indexOf(endTag, endIndex);

          if (nextClose === -1) break;
          if (nextOpen !== -1 && nextOpen < nextClose) {
            depth++;
            endIndex = nextOpen + 1;
          } else {
            depth--;
            endIndex = nextClose + endTag.length;
          }
        }

        return html.substring(startIndex, endIndex);
      }
    }

    return null;
  }

  /**
   * Extract feature cards from HTML
   * @param {string} html
   * @returns {string[]}
   */
  extractFeatureCards(html) {
    const cards = [];

    // Look for common card patterns
    const cardPatterns = [
      /<div[^>]*class\s*=\s*["'][^"']*card[^"']*["'][^>]*>/gi,
      /<div[^>]*class\s*=\s*["'][^"']*feature[^"']*["'][^>]*>/gi,
    ];

    for (const pattern of cardPatterns) {
      const matches = html.match(pattern) || [];
      cards.push(...matches.slice(0, 6));
    }

    return cards;
  }

  /**
   * Save mined template to file
   * @param {string} jobId
   * @param {object} result
   */
  async saveMinedTemplate(jobId, result) {
    if (!fs.existsSync(this.outputPath)) {
      fs.mkdirSync(this.outputPath, { recursive: true });
    }

    const filePath = path.join(this.outputPath, `${jobId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(result, null, 2), 'utf-8');
  }

  /**
   * Create a template from mining results
   * @param {string} jobId
   * @param {object} result
   * @returns {object|null}
   */
  async createTemplateFromMining(jobId, result) {
    try {
      const template = await TemplateRepository.create({
        name: result.title || `Mined Template ${jobId}`,
        description: result.description || `Template mined from ${result.url}`,
        category: this.inferCategory(result.sections),
        stack: 'static-html-tailwind',
        source: 'mined',
        is_public: false,
        config: {
          minedFrom: result.url,
          sections: result.sections,
          colorPalette: result.colorPalette,
          typography: result.typography,
          techStack: result.techStack,
        },
        tags: [...result.sections, 'mined'],
      });

      return template;
    } catch (error) {
      console.error('[MiningService] Failed to create template from mining:', error.message);
      return null;
    }
  }

  /**
   * Infer template category from sections
   * @param {string[]} sections
   * @returns {string}
   */
  inferCategory(sections) {
    const categoryMap = {
      pricing: 'saas',
      features: 'saas',
      testimonial: 'business',
      hero: 'landing',
      cta: 'landing',
      footer: 'landing',
    };

    for (const section of sections) {
      for (const [key, category] of Object.entries(categoryMap)) {
        if (section.includes(key)) return category;
      }
    }

    return 'landing';
  }

  /**
   * Format template result for response
   * @param {object} result
   * @returns {object}
   */
  async formatTemplateResult(result) {
    return {
      name: result.title,
      description: result.description,
      sections: result.sections,
      colorPalette: result.colorPalette,
      typography: result.typography,
      techStack: result.techStack,
      componentCount: result.components?.count || 0,
      componentTypes: result.components?.components?.map((c) => c.type) || [],
    };
  }
}

module.exports = new MiningService();
