/**
 * performanceValidator.js — NEXO Landing Page Creator v3.0
 * Validates performance best practices: lazy loading, critical CSS, font display, render-blocking.
 * Returns: { score: 0-100, issues: [...], passed: boolean }
 */

const { JSDOM } = require('jsdom');

/**
 * Validate performance optimizations in HTML.
 * @param {string} html - Raw HTML string
 * @returns {Object} { score, issues[], passed, summary }
 */
function validatePerformance(html) {
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

  // ─── 1. Image Lazy Loading ────────────────────────────────────────
  const images = document.querySelectorAll('img');
  let imagesWithoutLazy = 0;
  images.forEach((img, idx) => {
    const loading = img.getAttribute('loading');
    const src = img.getAttribute('src') || img.getAttribute('data-src') || '(no src)';
    // Skip small/above-fold images (heuristic: first 2 images)
    if (idx < 2) return;
    if (loading !== 'lazy') {
      imagesWithoutLazy++;
    }
  });

  if (images.length > 2 && imagesWithoutLazy > 0) {
    issues.push({
      severity: 'error',
      message: `${imagesWithoutLazy} of ${images.length - 2} below-fold images missing loading="lazy"`,
      selector: 'img:not([loading="lazy"])',
    });
  }

  // ─── 2. Responsive Images (srcset) ──────────────────────────────
  let imagesWithoutSrcset = 0;
  images.forEach((img) => {
    if (!img.hasAttribute('srcset') && !img.hasAttribute('data-srcset')) {
      imagesWithoutSrcset++;
    }
  });

  if (images.length > 0 && imagesWithoutSrcset === images.length) {
    issues.push({
      severity: 'warning',
      message: 'No images use srcset — consider responsive images for better performance',
      selector: 'img',
    });
  }

  // ─── 3. Image Dimensions (width/height attributes) ────────────────
  let imagesWithoutDimensions = 0;
  images.forEach((img) => {
    if (!img.hasAttribute('width') || !img.hasAttribute('height')) {
      imagesWithoutDimensions++;
    }
  });

  if (images.length > 0 && imagesWithoutDimensions > 0) {
    issues.push({
      severity: 'warning',
      message: `${imagesWithoutDimensions} image(s) missing width/height attributes — causes layout shift (CLS)`,
      selector: 'img:not([width]):not([height])',
    });
  }

  // ─── 4. Critical CSS Inline ───────────────────────────────────────
  const inlineStyles = document.querySelectorAll('style');
  const externalStyles = document.querySelectorAll('link[rel="stylesheet"]');

  if (inlineStyles.length === 0 && externalStyles.length > 0) {
    issues.push({
      severity: 'info',
      message: 'No inline <style> block for critical CSS — consider inlining above-fold styles',
      selector: 'style',
    });
  }

  // ─── 5. Render-Blocking Resources ─────────────────────────────────
  // Check for render-blocking stylesheets not marked with media or preload
  externalStyles.forEach((link) => {
    const media = link.getAttribute('media');
    const rel = link.getAttribute('rel');
    const href = link.getAttribute('href') || '';

    if (rel === 'stylesheet' && !media && !href.includes('preload')) {
      issues.push({
        severity: 'warning',
        message: `Render-blocking stylesheet: ${href} — consider preloading or async loading`,
        selector: `link[rel="stylesheet"][href="${href}"]`,
      });
    }
  });

  // Check for render-blocking scripts in <head> without async/defer
  if (head) {
    const headScripts = head.querySelectorAll('script[src]:not([async]):not([defer]):not([type="module"])');
    headScripts.forEach((script) => {
      const src = script.getAttribute('src') || '';
      // Exclude critical inline scripts
      issues.push({
        severity: 'warning',
        message: `Render-blocking script in <head>: ${src} — add async, defer, or move to </body>`,
        selector: `script[src="${src}"]`,
      });
    });
  }

  // ─── 6. Font Display Swap ─────────────────────────────────────────
  // Check @font-face declarations for font-display
  const allStyleContent = Array.from(inlineStyles).map((s) => s.textContent).join(' ');
  const fontFaceRegex = /@font-face\s*\{/gi;
  const fontDisplayRegex = /font-display\s*:\s*\w+/gi;

  const fontFaceCount = (allStyleContent.match(fontFaceRegex) || []).length;
  const fontDisplayCount = (allStyleContent.match(fontDisplayRegex) || []).length);

  if (fontFaceCount > 0 && fontDisplayCount < fontFaceCount) {
    issues.push({
      severity: 'error',
      message: `${fontFaceCount - fontDisplayCount} of ${fontFaceCount} @font-face declarations missing font-display — use font-display: swap`,
    });
  }

  // Check Google Fonts link for &display=swap
  const googleFontLinks = document.querySelectorAll('link[href*="fonts.googleapis.com"]');
  googleFontLinks.forEach((link) => {
    const href = link.getAttribute('href') || '';
    if (!href.includes('display=')) {
      issues.push({
        severity: 'error',
        message: 'Google Fonts link missing display=swap parameter — causes FOIT (Flash of Invisible Text)',
        selector: 'link[href*="fonts.googleapis.com"]',
      });
    }
  });

  // ─── 7. Minimal External Requests ─────────────────────────────────
  const externalScripts = document.querySelectorAll('script[src]');
  const externalLinks = document.querySelectorAll('link[rel="stylesheet"]');
  const totalExternal = externalScripts.length + externalLinks.length;

  if (totalExternal > 10) {
    issues.push({
      severity: 'warning',
      message: `High number of external requests (${totalExternal}) — consider bundling or inlining`,
    });
  }

  // ─── 8. Preconnect to Required Origins ────────────────────────────
  const preconnects = document.querySelectorAll('link[rel="preconnect"]');
  const dnsPrefetch = document.querySelectorAll('link[rel="dns-prefetch"]');
  const hasPreconnectHints = preconnects.length > 0 || dnsPrefetch.length > 0;

  if (totalExternal > 3 && !hasPreconnectHints) {
    issues.push({
      severity: 'info',
      message: 'Consider adding <link rel="preconnect"> for external domains to reduce connection setup time',
    });
  }

  // ─── 9. Preload Critical Resources ────────────────────────────────
  const preloads = document.querySelectorAll('link[rel="preload"]');
  if (preloads.length === 0 && (externalStyles.length > 0 || externalScripts.length > 0)) {
    issues.push({
      severity: 'info',
      message: 'Consider preloading critical CSS/JS with <link rel="preload">',
    });
  }

  // ─── 10. Minification Hint (HTML size check) ──────────────────────
  const htmlSize = html.length;
  if (htmlSize > 100000) {
    // ~100KB
    issues.push({
      severity: 'info',
      message: `HTML document is ${(htmlSize / 1024).toFixed(1)}KB — consider minifying or code-splitting`,
    });
  }

  // ─── 11. Modern Image Formats Hint ────────────────────────────────
  const imageSrcs = Array.from(images).map((img) => img.getAttribute('src') || '');
  const hasWebp = imageSrcs.some((src) => src.includes('.webp'));
  const hasAvif = imageSrcs.some((src) => src.includes('.avif'));
  const totalContentImages = imageSrcs.filter((s) => s && !s.startsWith('data:')).length;

  if (totalContentImages > 0 && !hasWebp && !hasAvif) {
    issues.push({
      severity: 'info',
      message: 'Consider using WebP or AVIF image formats for better compression',
    });
  }

  // ─── 12. Resource Hints for Fonts ─────────────────────────────────
  // Check for font preloading
  const fontPreloads = document.querySelectorAll('link[rel="preload"][as="font"]');
  if (googleFontLinks.length > 0 && fontPreloads.length === 0) {
    issues.push({
      severity: 'info',
      message: 'Consider preloading critical font files with <link rel="preload" as="font">',
    });
  }

  // ─── Score Calculation ────────────────────────────────────────────
  const weights = {
    critical: 25,
    error: 10,
    warning: 4,
    info: 0,
  };

  const deductions = issues.reduce((sum, issue) => sum + (weights[issue.severity] || 0), 0);
  let score = Math.max(0, 100 - deductions);

  // Bonuses
  const lazyLoadRatio = images.length > 2 ? (images.length - 2 - imagesWithoutLazy) / (images.length - 2) : 1;
  score = Math.min(100, score + lazyLoadRatio * 10);

  if (fontDisplayCount >= fontFaceCount && fontFaceCount > 0) score = Math.min(100, score + 5);
  if (totalExternal <= 5) score = Math.min(100, score + 5);
  if (hasPreconnectHints) score = Math.min(100, score + 3);
  if (imagesWithoutDimensions === 0 && images.length > 0) score = Math.min(100, score + 5);

  return {
    score: Math.round(score),
    issues,
    passed: score >= 65 && !issues.some((i) => i.severity === 'critical'),
    summary: {
      totalImages: images.length,
      imagesWithLazyLoading: images.length - imagesWithoutLazy,
      imagesWithoutDimensions,
      inlineStyles: inlineStyles.length,
      externalStylesheets: externalStyles.length,
      externalScripts: externalScripts.length,
      totalExternalRequests: totalExternal,
      fontFaceDeclarations: fontFaceCount,
      fontDisplayDeclarations: fontDisplayCount,
      hasFontSwap: fontDisplayCount >= fontFaceCount,
      preconnectHints: preconnects.length,
      preloadHints: preloads.length,
      htmlSizeBytes: htmlSize,
      usesModernImageFormats: hasWebp || hasAvif,
    },
  };
}

module.exports = { validatePerformance };
