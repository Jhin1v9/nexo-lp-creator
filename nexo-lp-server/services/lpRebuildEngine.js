/**
 * NEXO Landing Page Creator v3.0 - Rebuild Engine
 *
 * Automatically fixes detected bugs in generated HTML.
 * Applies targeted fixes based on bug reports, with a maximum
 * of 3 attempts to resolve all issues.
 *
 * @module services/lpRebuildEngine
 * @version 3.0.0
 */

const config = require('../config/nexo-lp-config');

class RebuildEngine {
  constructor() {
    this.maxAttempts = config.rebuild.maxAttempts || 3;
    this.autoFixEnabled = config.rebuild.autoFixEnabled !== false;
    this.fixStrategies = config.rebuild.fixStrategies || ['auto_fix', 'simplify_markup', 'regenerate_section'];
  }

  /**
   * Rebuild HTML by applying fixes for detected bugs
   * @param {string} sessionId
   * @param {string} html - Current HTML content
   * @param {Array} bugs - List of bugs from BugDetectorService
   * @param {number} maxAttempts - Override max attempts
   * @returns {object} { html, fixesApplied, attemptsUsed, remainingIssues }
   */
  async rebuild(sessionId, html, bugs, maxAttempts) {
    const attemptsLimit = maxAttempts || this.maxAttempts;

    if (!this.autoFixEnabled) {
      return {
        html,
        fixesApplied: [],
        attemptsUsed: 0,
        remainingIssues: bugs,
        message: 'Auto-fix is disabled',
      };
    }

    if (!bugs || bugs.length === 0) {
      return {
        html,
        fixesApplied: [],
        attemptsUsed: 0,
        remainingIssues: [],
        message: 'No bugs to fix',
      };
    }

    let currentHtml = html;
    const allFixes = [];
    let remainingIssues = [...bugs];

    for (let attempt = 1; attempt <= attemptsLimit; attempt++) {
      if (remainingIssues.length === 0) {
        break;
      }

      const attemptFixes = [];

      // Process each remaining issue
      for (const bug of remainingIssues) {
        const fix = this.applyFix(currentHtml, bug);

        if (fix.applied) {
          currentHtml = fix.html;
          attemptFixes.push({
            bug: bug.message,
            fix: fix.description,
            severity: bug.severity,
          });
        }
      }

      allFixes.push(...attemptFixes);

      // Re-validate remaining issues
      remainingIssues = await this.revalidate(currentHtml, remainingIssues);

      // If no fixes were applied this attempt, try fallback strategy
      if (attemptFixes.length === 0 && remainingIssues.length > 0) {
        const fallbackFix = this.applyFallbackFix(currentHtml, remainingIssues, attempt);
        if (fallbackFix.applied) {
          currentHtml = fallbackFix.html;
          allFixes.push({
            bug: 'Multiple issues',
            fix: fallbackFix.description,
            severity: 'warning',
          });
          remainingIssues = await this.revalidate(currentHtml, remainingIssues);
        }
      }
    }

    return {
      html: currentHtml,
      fixesApplied: allFixes,
      attemptsUsed: Math.min(attemptsLimit, allFixes.length > 0 ? attemptsLimit : 0),
      remainingIssues,
      allIssuesResolved: remainingIssues.length === 0,
      message: remainingIssues.length === 0
        ? 'All issues resolved'
        : `${remainingIssues.length} issue(s) could not be auto-fixed`,
    };
  }

  /**
   * Apply a fix for a specific bug
   * @param {string} html
   * @param {object} bug - Bug from detector
   * @returns {object} { applied, html, description }
   */
  applyFix(html, bug) {
    if (!html || !bug) {
      return { applied: false, html, description: 'Invalid input' };
    }

    const message = (bug.message || '').toLowerCase();
    let fixed = html;
    let applied = false;
    let description = 'No fix applied';

    // Fix: Missing viewport meta tag
    if (message.includes('viewport') || message.includes('responsive meta')) {
      fixed = this.fixViewportMeta(fixed);
      if (fixed !== html) {
        applied = true;
        description = 'Added viewport meta tag';
      }
    }

    // Fix: Missing charset
    if (message.includes('charset')) {
      fixed = this.fixCharset(fixed);
      if (fixed !== html) {
        applied = true;
        description = 'Added charset meta tag';
      }
    }

    // Fix: Images without alt
    if (message.includes('alt text') || message.includes('alt=')) {
      fixed = this.fixMissingAlt(fixed);
      if (fixed !== html) {
        applied = true;
        description = 'Added alt attributes to images';
      }
    }

    // Fix: Unclosed tags
    if (message.includes('unclosed')) {
      fixed = this.fixUnclosedTags(fixed);
      if (fixed !== html) {
        applied = true;
        description = 'Fixed unclosed HTML tags';
      }
    }

    // Fix: Missing title
    if (message.includes('title')) {
      fixed = this.fixMissingTitle(fixed);
      if (fixed !== html) {
        applied = true;
        description = 'Added title tag';
      }
    }

    // Fix: Missing meta description
    if (message.includes('meta description')) {
      fixed = this.fixMetaDescription(fixed);
      if (fixed !== html) {
        applied = true;
        description = 'Added meta description';
      }
    }

    // Fix: White-on-white colors
    if (message.includes('white-on-white') || message.includes('contrast')) {
      fixed = this.fixColorContrast(fixed);
      if (fixed !== html) {
        applied = true;
        description = 'Adjusted color contrast';
      }
    }

    // Fix: Missing heading
    if (message.includes('no h1') || message.includes('heading')) {
      fixed = this.fixMissingHeading(fixed);
      if (fixed !== html) {
        applied = true;
        description = 'Added heading element';
      }
    }

    // Fix: Empty content
    if (message.includes('empty container')) {
      fixed = this.fixEmptyContainers(fixed);
      if (fixed !== html) {
        applied = true;
        description = 'Removed or populated empty containers';
      }
    }

    return { applied, html: fixed, description };
  }

  /**
   * Apply fallback fix when specific fixes don't work
   * @param {string} html
   * @param {Array} remainingIssues
   * @param {number} attempt
   * @returns {object}
   */
  applyFallbackFix(html, remainingIssues, attempt) {
    let fixed = html;
    let applied = false;
    let description = '';

    const strategy = this.fixStrategies[attempt - 1] || this.fixStrategies[this.fixStrategies.length - 1];

    switch (strategy) {
      case 'auto_fix':
        // Try comprehensive auto-fix
        fixed = this.applyComprehensiveFix(fixed);
        applied = true;
        description = 'Applied comprehensive auto-fix';
        break;

      case 'simplify_markup':
        // Simplify complex markup
        fixed = this.simplifyMarkup(fixed);
        applied = true;
        description = 'Simplified complex markup';
        break;

      case 'regenerate_section':
        // Wrap in proper structure as last resort
        fixed = this.wrapInProperStructure(fixed);
        applied = true;
        description = 'Wrapped in proper HTML structure';
        break;

      default:
        fixed = this.wrapInProperStructure(fixed);
        applied = true;
        description = 'Applied structure wrap fallback';
    }

    return { applied, html: fixed, description };
  }

  /**
   * Re-validate remaining issues after fixes
   * @param {string} html
   * @param {Array} previousIssues
   * @returns {Array} Issues still present
   */
  async revalidate(html, previousIssues) {
    // Simple revalidation: check if the issue message keywords are still present
    const remaining = [];

    for (const issue of previousIssues) {
      const message = (issue.message || '').toLowerCase();

      // Check if viewport is still missing
      if (message.includes('viewport') && (!html.includes('viewport') || !html.includes('width=device-width'))) {
        remaining.push(issue);
        continue;
      }

      // Check if alt is still missing for images
      if (message.includes('alt text')) {
        const imgTags = html.match(/<img[^>]*>/gi) || [];
        const withoutAlt = imgTags.filter((img) => !img.toLowerCase().includes('alt='));
        if (withoutAlt.length > 0) {
          remaining.push({ ...issue, message: `${withoutAlt.length} image(s) missing alt text` });
        }
        continue;
      }

      // If we can't specifically check, assume it might be fixed on attempt > 1
      // to prevent infinite loops
      remaining.push(issue);
    }

    return remaining;
  }

  // ============================================================
  // Individual Fix Implementations
  // ============================================================

  /**
   * Add viewport meta tag
   */
  fixViewportMeta(html) {
    const viewportMeta = '<meta name="viewport" content="width=device-width, initial-scale=1.0">';

    if (html.includes('<head>')) {
      return html.replace('<head>', `<head>\n  ${viewportMeta}`);
    }

    if (html.includes('<html')) {
      return html.replace('<html>', `<html>\n<head>\n  ${viewportMeta}\n</head>`);
    }

    return viewportMeta + '\n' + html;
  }

  /**
   * Add charset meta tag
   */
  fixCharset(html) {
    const charsetMeta = '<meta charset="UTF-8">';

    if (html.includes('<head>')) {
      return html.replace('<head>', `<head>\n  ${charsetMeta}`);
    }

    return charsetMeta + '\n' + html;
  }

  /**
   * Add alt attributes to images without them
   */
  fixMissingAlt(html) {
    return html.replace(/<img\s+([^>]*)(?<!alt=["'][^"']*["']\s*)>/gi, (match, attrs) => {
      if (attrs.includes('alt=')) return match;
      return `<img ${attrs} alt="">`;
    });
  }

  /**
   * Fix common unclosed tags
   */
  fixUnclosedTags(html) {
    // Fix common unclosed container tags
    const pairs = [
      ['<div', '</div>'],
      ['<section', '</section>'],
      ['<article', '</article>'],
      ['<main', '</main>'],
      ['<header', '</header>'],
      ['<footer', '</footer>'],
      ['<nav', '</nav>'],
      ['<aside', '</aside>'],
    ];

    let fixed = html;
    for (const [open, close] of pairs) {
      const openCount = (fixed.match(new RegExp(open, 'gi')) || []).length;
      const closeCount = (fixed.match(new RegExp(close, 'gi')) || []).length;

      if (openCount > closeCount) {
        // Add missing closing tags at the end
        const diff = openCount - closeCount;
        fixed += '\n' + close.repeat(diff);
      }
    }

    return fixed;
  }

  /**
   * Add title tag
   */
  fixMissingTitle(html) {
    const titleTag = '<title>Landing Page</title>';

    if (html.includes('<head>')) {
      return html.replace('<head>', `<head>\n  ${titleTag}`);
    }

    return titleTag + '\n' + html;
  }

  /**
   * Add meta description
   */
  fixMetaDescription(html) {
    const descMeta = '<meta name="description" content="A landing page created with NEXO">';

    if (html.includes('<head>')) {
      return html.replace('<head>', `<head>\n  ${descMeta}`);
    }

    return descMeta + '\n' + html;
  }

  /**
   * Fix color contrast issues (basic)
   */
  fixColorContrast(html) {
    // Replace white-on-white with more visible colors
    return html
      .replace(/color\s*:\s*#fff\s*;?\s*background\s*:\s*#fff/gi, 'color: #333; background: #fff')
      .replace(/color\s*:\s*white\s*;?\s*background\s*:\s*white/gi, 'color: #333; background: white');
  }

  /**
   * Add a heading if missing
   */
  fixMissingHeading(html) {
    const heading = '<h1 class="text-4xl font-bold">Welcome</h1>';

    if (html.includes('<body>')) {
      return html.replace('<body>', `<body>\n${heading}`);
    }

    if (html.includes('<main>')) {
      return html.replace('<main>', `<main>\n${heading}`);
    }

    return heading + '\n' + html;
  }

  /**
   * Remove or populate empty container elements
   */
  fixEmptyContainers(html) {
    // Replace empty divs with comment placeholders
    return html.replace(
      /<(div|section|article|main|header|footer|nav)\s+([^>]*)>\s*<\/\1>/gi,
      '<!-- Empty $1 removed -->'
    );
  }

  /**
   * Apply comprehensive fixes
   */
  applyComprehensiveFix(html) {
    let fixed = html;
    fixed = this.fixViewportMeta(fixed);
    fixed = this.fixCharset(fixed);
    fixed = this.fixMissingAlt(fixed);
    fixed = this.fixUnclosedTags(fixed);
    fixed = this.fixMissingTitle(fixed);
    fixed = this.fixMetaDescription(fixed);
    return fixed;
  }

  /**
   * Simplify complex markup
   */
  simplifyMarkup(html) {
    // Remove excessive nesting (simplify 3+ nested divs)
    return html
      .replace(/<div>\s*<div>\s*<div>/gi, '<div>')
      .replace(/<\/div>\s*<\/div>\s*<\/div>/gi, '</div>');
  }

  /**
   * Wrap content in proper HTML structure
   */
  wrapInProperStructure(html) {
    // If already a complete document, return as-is
    if (html.toLowerCase().includes('<!doctype') || html.toLowerCase().includes('<html')) {
      return html;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Landing Page</title>
  <meta name="description" content="A landing page created with NEXO">
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
</head>
<body>
${html}
</body>
</html>`;
  }
}

module.exports = new RebuildEngine();
