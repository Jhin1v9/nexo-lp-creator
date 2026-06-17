/**
 * NEXO Landing Page Creator v3.0 - Bug Detector Service
 *
 * Runs validators on generated HTML to detect issues.
 * Aggregates scores and returns a structured report.
 *
 * Validators:
 *   - HTML structure validation
 *   - CSS validation
 *   - Accessibility (a11y) checks
 *   - SEO validation
 *   - Responsive design checks
 *   - Performance checks
 *
 * @module services/lpBugDetectorService
 * @version 3.0.0
 */

const config = require('../config/nexo-lp-config');

class BugDetectorService {
  constructor() {
    this.enabled = config.bugDetection.enabled !== false;
    this.maxIssues = config.bugDetection.maxIssues || 50;
  }

  /**
   * Run all bug detection validators
   * @param {string} sessionId
   * @param {string} html - HTML content (optional, fetches from session if not provided)
   * @returns {object} Structured bug report
   */
  async detect(sessionId, html) {
    if (!this.enabled) {
      return this.createEmptyReport();
    }

    // If HTML not provided, try to get from session
    let content = html;
    if (!content) {
      const SessionRepository = require('../models/repositories/SessionRepository');
      const session = await SessionRepository.findById(sessionId);
      if (session && session.current_html) {
        content = session.current_html;
      }
    }

    if (!content) {
      return {
        ...this.createEmptyReport(),
        passed: false,
        error: 'No HTML content found for detection',
      };
    }

    // Run all validators in parallel
    const results = await Promise.all([
      this.validateHtmlStructure(content),
      this.validateCss(content),
      this.validateAccessibility(content),
      this.validateSeo(content),
      this.validateResponsive(content),
      this.validatePerformance(content),
    ]);

    // Aggregate all issues
    const allIssues = [];
    let totalScore = 0;

    for (const result of results) {
      totalScore += result.score;
      if (result.issues) {
        allIssues.push(...result.issues);
      }
    }

    // Calculate overall score (average of all validators, normalized to 0-100)
    const overallScore = Math.round(totalScore / results.length);

    // Sort issues by severity
    allIssues.sort((a, b) => {
      const severityOrder = { critical: 0, error: 1, warning: 2, info: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    // Limit number of issues
    const limitedIssues = allIssues.slice(0, this.maxIssues);

    // Count by severity
    const counts = this.countBySeverity(limitedIssues);

    return {
      sessionId,
      score: overallScore,
      passed: overallScore >= 70 && counts.critical === 0 && counts.error === 0,
      summary: {
        totalIssues: allIssues.length,
        shownIssues: limitedIssues.length,
        critical: counts.critical,
        error: counts.error,
        warning: counts.warning,
        info: counts.info,
      },
      validators: results.map((r) => ({
        name: r.validator,
        score: r.score,
        passed: r.passed,
        issueCount: r.issues?.length || 0,
      })),
      issues: limitedIssues,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Validate HTML structure
   */
  async validateHtml(html) {
    return this.validateHtmlStructure(html);
  }

  /**
   * Validate HTML structure integrity
   */
  async validateHtmlStructure(html) {
    const issues = [];
    let score = 100;

    if (!html || html.trim().length === 0) {
      return {
        validator: 'html-structure',
        score: 0,
        passed: false,
        issues: [{ severity: 'critical', message: 'HTML content is empty', category: 'structure' }],
      };
    }

    // Check for DOCTYPE
    if (!html.toLowerCase().includes('<!doctype') && !html.toLowerCase().includes('<html')) {
      issues.push({ severity: 'warning', message: 'Missing DOCTYPE or HTML tag', category: 'structure' });
      score -= 5;
    }

    // Check for unclosed tags (basic regex-based check)
    const unclosedTags = this.findUnclosedTags(html);
    if (unclosedTags.length > 0) {
      issues.push({
        severity: 'error',
        message: `Potentially unclosed tags: ${unclosedTags.join(', ')}`,
        category: 'structure',
        details: unclosedTags,
      });
      score -= Math.min(unclosedTags.length * 5, 30);
    }

    // Check for missing essential elements
    if (!html.includes('<title') && !html.includes('<h1')) {
      issues.push({ severity: 'warning', message: 'No title or h1 tag found', category: 'structure' });
      score -= 5;
    }

    // Check for broken comments
    const brokenComments = (html.match(/<!--[^>]*(?<!-)>/g) || []).filter((c) => !c.endsWith('-->'));
    if (brokenComments.length > 0) {
      issues.push({ severity: 'warning', message: 'Potentially broken HTML comments detected', category: 'structure' });
      score -= 5;
    }

    // Check for empty elements that shouldn't be
    const emptyElements = html.match(/<(div|section|article|main|header|footer|nav)\s*[^>]*>\s*<\/\1>/gi);
    if (emptyElements && emptyElements.length > 3) {
      issues.push({ severity: 'info', message: `${emptyElements.length} potentially empty container elements`, category: 'structure' });
      score -= 3;
    }

    return {
      validator: 'html-structure',
      score: Math.max(0, score),
      passed: score >= 70,
      issues,
    };
  }

  /**
   * Validate CSS within the HTML
   */
  async validateCss(html) {
    const issues = [];
    let score = 100;

    if (!html) {
      return { validator: 'css', score: 0, passed: false, issues: [] };
    }

    // Extract inline styles
    const inlineStyles = html.match(/style\s*=\s*"([^"]*)"/gi) || [];
    const styleBlocks = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];

    // Check for inline styles (warning, not error)
    if (inlineStyles.length > 20) {
      issues.push({ severity: 'info', message: `High number of inline styles (${inlineStyles.length})`, category: 'css' });
      score -= 2;
    }

    // Check for common CSS mistakes
    const cssContent = styleBlocks.join(' ');

    // Check for vendor prefixes without standard property
    const vendorPrefixes = cssContent.match(/-\w+-\w+\s*:/g) || [];
    if (vendorPrefixes.length > 0) {
      // This is just informational
      issues.push({ severity: 'info', message: `Found ${vendorPrefixes.length} vendor-prefixed properties`, category: 'css' });
    }

    // Check for potentially unsupported CSS
    const modernCss = cssContent.match(/(grid|flex|clamp|min\(|max\(|@container)/gi) || [];
    if (modernCss.length > 0) {
      issues.push({ severity: 'info', message: 'Modern CSS features detected - check browser compatibility', category: 'css' });
    }

    // Check for missing CSS entirely
    if (inlineStyles.length === 0 && styleBlocks.length === 0 && !html.includes('tailwindcss') && !html.includes('cdn.tailwindcss.com')) {
      issues.push({ severity: 'warning', message: 'No CSS styling detected', category: 'css' });
      score -= 15;
    }

    return {
      validator: 'css',
      score: Math.max(0, score),
      passed: score >= 70,
      issues,
    };
  }

  /**
   * Validate accessibility (a11y)
   */
  async validateAccessibility(html) {
    const issues = [];
    let score = 100;

    if (!html) {
      return { validator: 'accessibility', score: 0, passed: false, issues: [] };
    }

    const lower = html.toLowerCase();

    // Check for images without alt
    const imgTags = html.match(/<img[^>]*>/gi) || [];
    const imgsWithoutAlt = imgTags.filter((img) => !img.toLowerCase().includes('alt='));
    if (imgsWithoutAlt.length > 0) {
      issues.push({ severity: 'error', message: `${imgsWithoutAlt.length} image(s) missing alt text`, category: 'accessibility' });
      score -= Math.min(imgsWithoutAlt.length * 5, 25);
    }

    // Check for form inputs without labels
    const inputs = html.match(/<input[^>]*>/gi) || [];
    const inputsWithoutLabels = inputs.filter((input) => {
      const hasLabel = input.toLowerCase().includes('aria-label') ||
        input.toLowerCase().includes('placeholder') ||
        input.toLowerCase().includes('id=');
      return !hasLabel;
    });
    if (inputsWithoutLabels.length > 0) {
      issues.push({ severity: 'warning', message: `${inputsWithoutLabels.length} input(s) may be missing labels`, category: 'accessibility' });
      score -= Math.min(inputsWithoutLabels.length * 3, 15);
    }

    // Check for low contrast indicators
    if (lower.includes('color:#fff') && lower.includes('background:#fff')) {
      issues.push({ severity: 'warning', message: 'Potential white-on-white color combination', category: 'accessibility' });
      score -= 10;
    }

    // Check for proper heading hierarchy
    const hasH1 = lower.includes('<h1');
    if (!hasH1) {
      issues.push({ severity: 'warning', message: 'No H1 heading found', category: 'accessibility' });
      score -= 10;
    }

    // Check for semantic HTML
    const semanticTags = ['header', 'nav', 'main', 'article', 'section', 'footer'];
    const usedSemantic = semanticTags.filter((tag) => lower.includes(`<${tag}`));
    if (usedSemantic.length === 0) {
      issues.push({ severity: 'info', message: 'No semantic HTML5 tags used', category: 'accessibility' });
      score -= 5;
    }

    // Check for interactive elements without focus indicators
    if ((lower.includes('<button') || lower.includes('onclick')) && !lower.includes(':focus')) {
      issues.push({ severity: 'info', message: 'Interactive elements may be missing focus styles', category: 'accessibility' });
      score -= 3;
    }

    return {
      validator: 'accessibility',
      score: Math.max(0, score),
      passed: score >= 70,
      issues,
    };
  }

  /**
   * Validate SEO
   */
  async validateSeo(html) {
    const issues = [];
    let score = 100;

    if (!html) {
      return { validator: 'seo', score: 0, passed: false, issues: [] };
    }

    const lower = html.toLowerCase();

    // Check for title
    if (!lower.includes('<title>')) {
      issues.push({ severity: 'error', message: 'Missing <title> tag', category: 'seo' });
      score -= 15;
    }

    // Check for meta description
    if (!lower.includes('name="description"') && !lower.includes("name='description'")) {
      issues.push({ severity: 'warning', message: 'Missing meta description', category: 'seo' });
      score -= 10;
    }

    // Check for viewport meta
    if (!lower.includes('viewport')) {
      issues.push({ severity: 'warning', message: 'Missing viewport meta tag', category: 'seo' });
      score -= 10;
    }

    // Check for canonical link
    if (!lower.includes('canonical')) {
      issues.push({ severity: 'info', message: 'No canonical link specified', category: 'seo' });
      score -= 3;
    }

    // Check for Open Graph tags
    if (!lower.includes('og:')) {
      issues.push({ severity: 'info', message: 'No Open Graph meta tags', category: 'seo' });
      score -= 3;
    }

    // Check for heading structure
    if (!lower.includes('<h1')) {
      issues.push({ severity: 'warning', message: 'No H1 heading - important for SEO', category: 'seo' });
      score -= 10;
    }

    // Check for img alt (also SEO relevant)
    const imgTags = html.match(/<img[^>]*>/gi) || [];
    const imgsWithoutAlt = imgTags.filter((img) => !img.toLowerCase().includes('alt='));
    if (imgsWithoutAlt.length > 0) {
      issues.push({ severity: 'warning', message: `${imgsWithoutAlt.length} image(s) without alt text (affects image SEO)`, category: 'seo' });
      score -= 5;
    }

    return {
      validator: 'seo',
      score: Math.max(0, score),
      passed: score >= 70,
      issues,
    };
  }

  /**
   * Validate responsive design
   */
  async validateResponsive(html) {
    const issues = [];
    let score = 100;

    if (!html) {
      return { validator: 'responsive', score: 0, passed: false, issues: [] };
    }

    const lower = html.toLowerCase();

    // Check for viewport meta
    if (!lower.includes('viewport') || !lower.includes('width=device-width')) {
      issues.push({ severity: 'error', message: 'Missing viewport meta tag for responsive design', category: 'responsive' });
      score -= 20;
    }

    // Check for media queries
    if (!lower.includes('@media') && !html.includes('tailwindcss') && !html.includes('cdn.tailwindcss.com')) {
      issues.push({ severity: 'warning', message: 'No media queries found and no Tailwind CSS detected', category: 'responsive' });
      score -= 15;
    }

    // Check for fixed widths that might break responsiveness
    const fixedWidths = html.match(/width:\s*\d+px/gi) || [];
    if (fixedWidths.length > 5) {
      issues.push({ severity: 'warning', message: `${fixedWidths.length} fixed pixel widths detected - may not be responsive`, category: 'responsive' });
      score -= 10;
    }

    // Check for Tailwind responsive classes
    if (html.includes('tailwindcss') || html.includes('cdn.tailwindcss.com')) {
      const responsiveClasses = html.match(/\b(sm:|md:|lg:|xl:|2xl:)[a-z-]+/gi) || [];
      if (responsiveClasses.length === 0) {
        issues.push({ severity: 'info', message: 'Using Tailwind but no responsive breakpoint classes found', category: 'responsive' });
        score -= 5;
      }
    }

    return {
      validator: 'responsive',
      score: Math.max(0, score),
      passed: score >= 70,
      issues,
    };
  }

  /**
   * Validate performance indicators
   */
  async validatePerformance(html) {
    const issues = [];
    let score = 100;

    if (!html) {
      return { validator: 'performance', score: 0, passed: false, issues: [] };
    }

    // Check for large inline images (data URIs)
    const dataUris = html.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g) || [];
    if (dataUris.length > 0) {
      const totalSize = dataUris.reduce((sum, uri) => sum + uri.length, 0);
      if (totalSize > 50000) {
        issues.push({ severity: 'warning', message: `Large inline images detected (${Math.round(totalSize / 1024)}KB base64)`, category: 'performance' });
        score -= 10;
      }
    }

    // Check for external resources loading
    const externalScripts = (html.match(/<script[^>]+src=/gi) || []).length;
    if (externalScripts > 5) {
      issues.push({ severity: 'info', message: `${externalScripts} external scripts may impact load time`, category: 'performance' });
      score -= 3;
    }

    // Check for excessive DOM depth (rough estimate)
    const depth = this.estimateDomDepth(html);
    if (depth > 15) {
      issues.push({ severity: 'info', message: `Estimated DOM depth (${depth}) may impact rendering performance`, category: 'performance' });
      score -= 3;
    }

    // Check for render-blocking patterns
    if (html.includes('@import')) {
      issues.push({ severity: 'warning', message: 'CSS @import may cause render blocking', category: 'performance' });
      score -= 5;
    }

    return {
      validator: 'performance',
      score: Math.max(0, score),
      passed: score >= 70,
      issues,
    };
  }

  /**
   * Find potentially unclosed tags
   */
  findUnclosedTags(html) {
    const tagPattern = /<([a-z][a-z0-9]*)[^>]*\/?>/gi;
    const closePattern = /<\/([a-z][a-z0-9]*)>/gi;

    const openTags = {};
    const closeTags = {};

    let match;
    while ((match = tagPattern.exec(html)) !== null) {
      const tag = match[1].toLowerCase();
      const isSelfClosing = match[0].endsWith('/>');
      const voidElements = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'];

      if (!isSelfClosing && !voidElements.includes(tag)) {
        openTags[tag] = (openTags[tag] || 0) + 1;
      }
    }

    while ((match = closePattern.exec(html)) !== null) {
      const tag = match[1].toLowerCase();
      closeTags[tag] = (closeTags[tag] || 0) + 1;
    }

    const unclosed = [];
    for (const [tag, count] of Object.entries(openTags)) {
      const closed = closeTags[tag] || 0;
      if (count > closed) {
        unclosed.push(`${tag} (${count - closed} unclosed)`);
      }
    }

    return unclosed;
  }

  /**
   * Estimate DOM depth (rough)
   */
  estimateDomDepth(html) {
    const lines = html.split('\n');
    let maxDepth = 0;
    let currentDepth = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('</')) {
        currentDepth = Math.max(0, currentDepth - 1);
      } else if (trimmed.startsWith('<') && !trimmed.startsWith('<!--') && !trimmed.endsWith('/>')) {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
      }
    }

    return maxDepth;
  }

  /**
   * Count issues by severity
   */
  countBySeverity(issues) {
    return {
      critical: issues.filter((i) => i.severity === 'critical').length,
      error: issues.filter((i) => i.severity === 'error').length,
      warning: issues.filter((i) => i.severity === 'warning').length,
      info: issues.filter((i) => i.severity === 'info').length,
    };
  }

  /**
   * Create an empty report (when detection is disabled)
   */
  createEmptyReport() {
    return {
      score: 100,
      passed: true,
      summary: { totalIssues: 0, shownIssues: 0, critical: 0, error: 0, warning: 0, info: 0 },
      validators: [],
      issues: [],
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = new BugDetectorService();
