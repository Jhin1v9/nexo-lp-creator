/**
 * htmlValidator.js — NEXO Landing Page Creator v3.0
 * Validates HTML structure, semantics, accessibility, and markup quality.
 * Returns: { score: 0-100, issues: [...], passed: boolean }
 */

const { JSDOM } = require('jsdom');

/**
 * Validate HTML string for semantic structure, accessibility, and quality.
 * @param {string} html - Raw HTML string to validate
 * @returns {Object} { score, issues[], passed }
 */
function validateHTML(html) {
  if (!html || typeof html !== 'string') {
    return {
      score: 0,
      issues: [{ severity: 'critical', message: 'HTML content is empty or not a string' }],
      passed: false,
    };
  }

  const issues = [];
  const dom = new JSDOM(html, { includeNodeLocations: true });
  const document = dom.window.document;

  // ─── 1. HTML5 Doctype ─────────────────────────────────────────────
  const hasDoctype = html.trim().toUpperCase().startsWith('<!DOCTYPE HTML');
  if (!hasDoctype) {
    issues.push({
      severity: 'critical',
      message: 'Missing or invalid HTML5 DOCTYPE declaration',
    });
  }

  // ─── 2. Semantic Structure (header, nav, main, section, footer) ───
  const semanticTags = ['header', 'nav', 'main', 'section', 'footer'];
  const semanticResults = {};
  semanticTags.forEach((tag) => {
    const elements = document.querySelectorAll(tag);
    semanticResults[tag] = elements.length;
    if (elements.length === 0) {
      issues.push({
        severity: 'warning',
        message: `Missing semantic <${tag}> element`,
        selector: tag,
      });
    }
  });

  // ─── 3. Single H1 Check ───────────────────────────────────────────
  const h1Elements = document.querySelectorAll('h1');
  if (h1Elements.length === 0) {
    issues.push({
      severity: 'error',
      message: 'No <h1> element found — every page must have exactly one H1',
      selector: 'h1',
    });
  } else if (h1Elements.length > 1) {
    issues.push({
      severity: 'error',
      message: `Multiple <h1> elements found (${h1Elements.length}) — only one allowed per page`,
      selector: 'h1',
    });
  }

  // ─── 4. Heading Hierarchy (no skipped levels) ─────────────────────
  const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
  const headingLevels = Array.from(headings).map((h) => parseInt(h.tagName[1], 10));
  let prevLevel = 0;
  headingLevels.forEach((level, idx) => {
    if (level > prevLevel + 1 && prevLevel !== 0) {
      issues.push({
        severity: 'warning',
        message: `Heading hierarchy skip: H${prevLevel} → H${level} (index ${idx})`,
        selector: headings[idx].tagName.toLowerCase(),
      });
    }
    prevLevel = level;
  });

  // ─── 5. Alt Text on All Images ────────────────────────────────────
  const images = document.querySelectorAll('img');
  images.forEach((img, idx) => {
    const alt = img.getAttribute('alt');
    const src = img.getAttribute('src') || '(no src)';
    if (alt === null || alt.trim() === '') {
      issues.push({
        severity: 'error',
        message: `Image ${idx + 1} missing alt text: src="${src}"`,
        selector: `img[src="${src}"]`,
      });
    }
  });

  // ─── 6. Broken / Unclosed Tags Detection ──────────────────────────
  const voidElements = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr',
  ]);
  const tagCounts = {};
  const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g;
  let match;
  while ((match = tagRegex.exec(html)) !== null) {
    const tagName = match[1].toLowerCase();
    if (voidElements.has(tagName)) continue;
    if (match[0].startsWith('</')) {
      tagCounts[tagName] = (tagCounts[tagName] || 0) - 1;
    } else {
      tagCounts[tagName] = (tagCounts[tagName] || 0) + 1;
    }
  }
  Object.entries(tagCounts).forEach(([tag, count]) => {
    if (count !== 0) {
      issues.push({
        severity: 'critical',
        message: `Potentially unclosed or mismatched <${tag}> tags (net: ${count})`,
        selector: tag,
      });
    }
  });

  // ─── 7. lang attribute on <html> ──────────────────────────────────
  const htmlEl = document.querySelector('html');
  if (!htmlEl || !htmlEl.getAttribute('lang')) {
    issues.push({
      severity: 'warning',
      message: 'Missing lang attribute on <html> element',
      selector: 'html',
    });
  }

  // ─── 8. charset meta tag ──────────────────────────────────────────
  const charsetMeta = document.querySelector('meta[charset]');
  if (!charsetMeta) {
    issues.push({
      severity: 'error',
      message: 'Missing charset meta tag (e.g., <meta charset="UTF-8">)',
      selector: 'meta[charset]',
    });
  }

  // ─── 9. viewport meta tag ─────────────────────────────────────────
  const viewportMeta = document.querySelector('meta[name="viewport"]');
  if (!viewportMeta) {
    issues.push({
      severity: 'error',
      message: 'Missing viewport meta tag for responsive design',
      selector: 'meta[name="viewport"]',
    });
  }

  // ─── 10. No empty links ───────────────────────────────────────────
  const links = document.querySelectorAll('a');
  links.forEach((link, idx) => {
    const href = link.getAttribute('href');
    if (!href || href.trim() === '' || href.trim() === '#') {
      issues.push({
        severity: 'warning',
        message: `Link ${idx + 1} has empty or placeholder href`,
        selector: `a:nth-of-type(${idx + 1})`,
      });
    }
  });

  // ─── 11. Form labels ──────────────────────────────────────────────
  const inputs = document.querySelectorAll('input, textarea, select');
  inputs.forEach((input, idx) => {
    const id = input.getAttribute('id');
    const ariaLabel = input.getAttribute('aria-label');
    const ariaLabelledBy = input.getAttribute('aria-labelledby');
    const hasLabel = id && document.querySelector(`label[for="${id}"]`);
    if (!hasLabel && !ariaLabel && !ariaLabelledBy && !input.placeholder) {
      issues.push({
        severity: 'warning',
        message: `Form input ${idx + 1} (${input.tagName}) missing label or aria-label`,
        selector: `${input.tagName.toLowerCase()}:nth-of-type(${idx + 1})`,
      });
    }
  });

  // ─── 12. Duplicate IDs ────────────────────────────────────────────
  const allElementsWithId = document.querySelectorAll('[id]');
  const idMap = {};
  allElementsWithId.forEach((el) => {
    const id = el.getAttribute('id');
    idMap[id] = (idMap[id] || 0) + 1;
  });
  Object.entries(idMap).forEach(([id, count]) => {
    if (count > 1) {
      issues.push({
        severity: 'error',
        message: `Duplicate ID "${id}" used ${count} times`,
        selector: `#${id}`,
      });
    }
  });

  // ─── Score Calculation ────────────────────────────────────────────
  const weights = {
    critical: 25,
    error: 10,
    warning: 3,
    info: 0,
  };

  const deductions = issues.reduce((sum, issue) => sum + (weights[issue.severity] || 0), 0);
  let score = Math.max(0, 100 - deductions);

  // Bonus: reward semantic richness
  const semanticTagsFound = semanticTags.filter((t) => semanticResults[t] > 0).length;
  score = Math.min(100, score + semanticTagsFound * 1.5);

  // Bonus: reward images with alt
  const imagesWithAlt = Array.from(images).filter((img) => {
    const alt = img.getAttribute('alt');
    return alt !== null && alt.trim() !== '';
  }).length;
  const altRatio = images.length > 0 ? imagesWithAlt / images.length : 1;
  score = Math.min(100, score + altRatio * 5);

  return {
    score: Math.round(score),
    issues,
    passed: score >= 70 && !issues.some((i) => i.severity === 'critical'),
    summary: {
      semanticElements: semanticResults,
      totalImages: images.length,
      imagesWithAlt,
      totalHeadings: headings.length,
      h1Count: h1Elements.length,
    },
  };
}

module.exports = { validateHTML };
