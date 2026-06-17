/**
 * seoValidator.js — NEXO Landing Page Creator v3.0
 * Validates SEO readiness: meta tags, Open Graph, Twitter Cards, schema, canonical.
 * Returns: { score: 0-100, issues: [...], passed: boolean }
 */

const { JSDOM } = require('jsdom');

/**
 * Validate SEO for an HTML document.
 * @param {string} html - Raw HTML string
 * @param {Object} options - Optional context { url, pageTitle }
 * @returns {Object} { score, issues[], passed, summary }
 */
function validateSEO(html, options = {}) {
  if (!html || typeof html !== 'string') {
    return {
      score: 0,
      issues: [{ severity: 'critical', message: 'HTML content is empty or not a string' }],
      passed: false,
    };
  }

  const issues = [];
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const head = document.querySelector('head');

  if (!head) {
    return {
      score: 0,
      issues: [{ severity: 'critical', message: 'No <head> section found in HTML' }],
      passed: false,
    };
  }

  // ─── 1. Title Tag ─────────────────────────────────────────────────
  const titleTag = document.querySelector('title');
  if (!titleTag || !titleTag.textContent.trim()) {
    issues.push({
      severity: 'critical',
      message: 'Missing or empty <title> tag',
      selector: 'title',
    });
  } else {
    const titleLength = titleTag.textContent.trim().length;
    if (titleLength < 10) {
      issues.push({
        severity: 'warning',
        message: `Title too short (${titleLength} chars) — aim for 50-60 characters`,
        selector: 'title',
      });
    } else if (titleLength > 70) {
      issues.push({
        severity: 'warning',
        message: `Title too long (${titleLength} chars) — may be truncated in SERP`,
        selector: 'title',
      });
    }
  }

  // ─── 2. Meta Description ──────────────────────────────────────────
  const metaDesc = document.querySelector('meta[name="description"]');
  if (!metaDesc || !metaDesc.getAttribute('content')) {
    issues.push({
      severity: 'critical',
      message: 'Missing meta description tag',
      selector: 'meta[name="description"]',
    });
  } else {
    const descLength = metaDesc.getAttribute('content').length;
    if (descLength < 50) {
      issues.push({
        severity: 'warning',
        message: `Meta description too short (${descLength} chars) — aim for 150-160`,
        selector: 'meta[name="description"]',
      });
    } else if (descLength > 170) {
      issues.push({
        severity: 'warning',
        message: `Meta description too long (${descLength} chars) — may be truncated`,
        selector: 'meta[name="description"]',
      });
    }
  }

  // ─── 3. Open Graph Tags ───────────────────────────────────────────
  const ogTags = [
    { property: 'og:title', severity: 'error' },
    { property: 'og:description', severity: 'error' },
    { property: 'og:image', severity: 'error' },
    { property: 'og:url', severity: 'error' },
    { property: 'og:type', severity: 'warning' },
  ];
  ogTags.forEach(({ property, severity }) => {
    const tag = document.querySelector(`meta[property="${property}"]`);
    if (!tag || !tag.getAttribute('content')) {
      issues.push({
        severity,
        message: `Missing Open Graph tag: ${property}`,
        selector: `meta[property="${property}"]`,
      });
    }
  });

  // ─── 4. Twitter Card Tags ─────────────────────────────────────────
  const twitterTags = [
    { name: 'twitter:card', severity: 'error' },
    { name: 'twitter:title', severity: 'warning' },
    { name: 'twitter:description', severity: 'warning' },
    { name: 'twitter:image', severity: 'warning' },
  ];
  twitterTags.forEach(({ name, severity }) => {
    const tag = document.querySelector(`meta[name="${name}"]`);
    if (!tag || !tag.getAttribute('content')) {
      issues.push({
        severity,
        message: `Missing Twitter Card tag: ${name}`,
        selector: `meta[name="${name}"]`,
      });
    }
  });

  // ─── 5. Canonical URL ─────────────────────────────────────────────
  const canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical || !canonical.getAttribute('href')) {
    issues.push({
      severity: 'error',
      message: 'Missing canonical URL link tag',
      selector: 'link[rel="canonical"]',
    });
  }

  // ─── 6. Robots Meta Tag ───────────────────────────────────────────
  const robotsMeta = document.querySelector('meta[name="robots"]');
  if (!robotsMeta) {
    issues.push({
      severity: 'info',
      message: 'Missing robots meta tag (defaults to index, follow)',
      selector: 'meta[name="robots"]',
    });
  } else {
    const content = robotsMeta.getAttribute('content') || '';
    if (content.includes('noindex')) {
      issues.push({
        severity: 'warning',
        message: 'Page is set to noindex — will not appear in search results',
        selector: 'meta[name="robots"]',
      });
    }
  }

  // ─── 7. Schema.org JSON-LD ────────────────────────────────────────
  const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
  if (jsonLdScripts.length === 0) {
    issues.push({
      severity: 'warning',
      message: 'Missing Schema.org JSON-LD structured data',
      selector: 'script[type="application/ld+json"]',
    });
  } else {
    jsonLdScripts.forEach((script, idx) => {
      try {
        const data = JSON.parse(script.textContent);
        if (!data['@context'] || !data['@context'].includes('schema.org')) {
          issues.push({
            severity: 'warning',
            message: `JSON-LD script ${idx + 1} missing valid @context`,
          });
        }
        if (!data['@type']) {
          issues.push({
            severity: 'warning',
            message: `JSON-LD script ${idx + 1} missing @type`,
          });
        }
      } catch (e) {
        issues.push({
          severity: 'error',
          message: `JSON-LD script ${idx + 1} contains invalid JSON`,
        });
      }
    });
  }

  // ─── 8. Favicon ───────────────────────────────────────────────────
  const favicon = document.querySelector('link[rel~="icon"]');
  if (!favicon) {
    issues.push({
      severity: 'info',
      message: 'Missing favicon link',
      selector: 'link[rel="icon"]',
    });
  }

  // ─── 9. Social Image Dimensions Check (basic) ─────────────────────
  const ogImage = document.querySelector('meta[property="og:image"]');
  if (ogImage) {
    const imgUrl = ogImage.getAttribute('content');
    if (imgUrl && (imgUrl.includes('1200') === false || imgUrl.includes('630') === false)) {
      // Info only — we can't verify actual dimensions from URL alone
      issues.push({
        severity: 'info',
        message: 'Ensure OG image is 1200x630px for optimal social sharing',
        selector: 'meta[property="og:image"]',
      });
    }
  }

  // ─── 10. Hreflang (optional, info) ────────────────────────────────
  const hreflang = document.querySelectorAll('link[rel="alternate"][hreflang]');
  if (hreflang.length === 0) {
    issues.push({
      severity: 'info',
      message: 'Consider adding hreflang tags for multi-language support',
    });
  }

  // ─── Score Calculation ────────────────────────────────────────────
  const weights = {
    critical: 25,
    error: 12,
    warning: 5,
    info: 0,
  };

  const deductions = issues.reduce((sum, issue) => sum + (weights[issue.severity] || 0), 0);
  let score = Math.max(0, 100 - deductions);

  // Bonus: all OG tags present
  const ogPresent = ogTags.filter(({ property }) =>
    document.querySelector(`meta[property="${property}"]`)
  ).length;
  score = Math.min(100, score + ogPresent * 1.5);

  // Bonus: JSON-LD present and valid
  if (jsonLdScripts.length > 0) {
    score = Math.min(100, score + 5);
  }

  return {
    score: Math.round(score),
    issues,
    passed: score >= 70 && !issues.some((i) => i.severity === 'critical'),
    summary: {
      title: titleTag ? titleTag.textContent.trim() : null,
      titleLength: titleTag ? titleTag.textContent.trim().length : 0,
      descriptionLength: metaDesc ? (metaDesc.getAttribute('content') || '').length : 0,
      ogTagsPresent: ogPresent,
      twitterTagsPresent: twitterTags.filter(({ name }) =>
        document.querySelector(`meta[name="${name}"]`)
      ).length,
      jsonLdScripts: jsonLdScripts.length,
      hasCanonical: !!canonical,
      hasRobotsMeta: !!robotsMeta,
    },
  };
}

module.exports = { validateSEO };
