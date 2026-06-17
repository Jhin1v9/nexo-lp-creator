/**
 * securityValidator.js — NEXO Landing Page Creator v3.0
 * Validates security best practices: no inline handlers, no eval, no innerHTML, HTTPS-only, CSP-friendly.
 * Returns: { score: 0-100, issues: [...], passed: boolean }
 */

const { JSDOM } = require('jsdom');

/**
 * Validate security practices in HTML/JS content.
 * @param {string} html - Raw HTML string (may include inline JS)
 * @returns {Object} { score, issues[], passed, summary }
 */
function validateSecurity(html) {
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
  const htmlLower = html.toLowerCase();

  // ─── 1. No Inline Event Handlers ──────────────────────────────────
  const inlineEventAttrs = [
    'onclick', 'ondblclick', 'onmousedown', 'onmouseup', 'onmouseover',
    'onmousemove', 'onmouseout', 'onkeydown', 'onkeypress', 'onkeyup',
    'onfocus', 'onblur', 'onchange', 'onsubmit', 'onreset', 'onselect',
    'onload', 'onunload', 'onerror', 'onresize', 'onscroll',
  ];

  // Check via regex for raw attribute detection (catches more cases)
  inlineEventAttrs.forEach((attr) => {
    const regex = new RegExp(`\\s${attr}\\s*=\\s*["']`, 'i');
    if (regex.test(html)) {
      issues.push({
        severity: 'error',
        message: `Inline event handler detected: ${attr} — use addEventListener instead`,
        selector: `[${attr}]`,
      });
    }
  });

  // Also check DOM
  const allElements = document.querySelectorAll('*');
  allElements.forEach((el) => {
    inlineEventAttrs.forEach((attr) => {
      if (el.hasAttribute(attr)) {
        issues.push({
          severity: 'error',
          message: `Element <${el.tagName.toLowerCase()}> has inline ${attr} handler`,
          selector: `${el.tagName.toLowerCase()}[${attr}]`,
        });
      }
    });
  });

  // ─── 2. No eval() Usage ───────────────────────────────────────────
  if (/\beval\s*\(/.test(html)) {
    issues.push({
      severity: 'critical',
      message: 'eval() detected — severe security risk, never use eval()',
    });
  }

  // ─── 3. No innerHTML with unsanitized content ─────────────────────
  // Check for innerHTML assignments in script tags
  const scripts = document.querySelectorAll('script:not([src])');
  scripts.forEach((script, idx) => {
    const content = script.textContent;
    if (/\.innerHTML\s*=/.test(content)) {
      // Check if it's assigning a literal string (safe-ish) vs a variable (risky)
      const innerHtmlMatches = content.match(/\.innerHTML\s*=\s*(.+)/g);
      if (innerHtmlMatches) {
        innerHtmlMatches.forEach((match) => {
          if (!match.includes("'`") && !match.includes('"`')) {
            // Likely assigning a variable or dynamic content
            issues.push({
              severity: 'error',
              message: `Unsanitized innerHTML assignment detected in inline script ${idx + 1}`,
              line: match.trim(),
            });
          }
        });
      }
    }
    // Check for document.write
    if (/document\.write\(/.test(content)) {
      issues.push({
        severity: 'warning',
        message: `document.write() usage detected in script ${idx + 1} — avoid for performance and security`,
      });
    }
  });

  // ─── 4. No Script Injection Vectors ───────────────────────────────
  const injectionPatterns = [
    { pattern: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script\s*>/gi, name: 'script tag injection' },
  ];
  
  // Check for javascript: protocol in hrefs
  const links = document.querySelectorAll('a[href^="javascript:"]');
  links.forEach((link) => {
    issues.push({
      severity: 'critical',
      message: `javascript: protocol detected in href: "${link.getAttribute('href')}" — XSS risk`,
      selector: `a[href^="javascript:"]`,
    });
  });

  // Check for data:text/html in href/src
  const dataHtmlLinks = document.querySelectorAll('[href^="data:text/html"], [src^="data:text/html"]');
  dataHtmlLinks.forEach((el) => {
    issues.push({
      severity: 'critical',
      message: `data:text/html URI detected in ${el.tagName.toLowerCase()} — potential injection vector`,
    });
  });

  // ─── 5. HTTPS-Only References ─────────────────────────────────────
  const httpResources = document.querySelectorAll('[src^="http://"], [href^="http://"]');
  httpResources.forEach((el) => {
    const attr = el.hasAttribute('src') ? 'src' : 'href';
    const url = el.getAttribute(attr);
    issues.push({
      severity: 'warning',
      message: `Insecure HTTP reference detected: ${url} — use HTTPS`,
      selector: `${el.tagName.toLowerCase()}[${attr}^="http://"]`,
    });
  });

  // Check for protocol-relative URLs (//example.com) — info only
  const protocolRelative = document.querySelectorAll('[src^="//"], [href^="//"]');
  if (protocolRelative.length > 0) {
    issues.push({
      severity: 'info',
      message: `${protocolRelative.length} protocol-relative URLs found — ensure they resolve to HTTPS`,
    });
  }

  // ─── 6. CSP-Friendly Code Checks ──────────────────────────────────
  // Check for inline scripts without nonce
  const inlineScripts = document.querySelectorAll('script:not([src]):not([nonce])');
  if (inlineScripts.length > 0) {
    issues.push({
      severity: 'warning',
      message: `${inlineScripts.length} inline script(s) without nonce — consider externalizing or adding nonce for CSP`,
      selector: 'script:not([src])',
    });
  }

  // Check for inline styles (style attribute) — common CSP concern
  const inlineStyles = document.querySelectorAll('[style]');
  if (inlineStyles.length > 0) {
    issues.push({
      severity: 'info',
      message: `${inlineStyles.length} inline style attribute(s) found — may conflict with strict style-src CSP directive`,
      selector: '[style]',
    });
  }

  // Check for CSP meta tag
  const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  if (!cspMeta) {
    issues.push({
      severity: 'info',
      message: 'No Content-Security-Policy meta tag — consider adding CSP headers for XSS protection',
      selector: 'meta[http-equiv="Content-Security-Policy"]',
    });
  }

  // ─── 7. External Script Integrity ─────────────────────────────────
  const externalScripts = document.querySelectorAll('script[src]');
  externalScripts.forEach((script) => {
    if (!script.hasAttribute('integrity') && !script.getAttribute('src').includes('googleapis')) {
      issues.push({
        severity: 'info',
        message: `External script missing integrity hash: ${script.getAttribute('src')}`,
        selector: `script[src="${script.getAttribute('src')}"]`,
      });
    }
  });

  // ─── 8. X-Frame-Options / Clickjacking ────────────────────────────
  const xFrameMeta = document.querySelector('meta[http-equiv="X-Frame-Options"]');
  if (!xFrameMeta) {
    issues.push({
      severity: 'info',
      message: 'Consider adding X-Frame-Options header to prevent clickjacking',
    });
  }

  // ─── 9. Referrer Policy ───────────────────────────────────────────
  const referrerMeta = document.querySelector('meta[name="referrer"]');
  if (!referrerMeta) {
    issues.push({
      severity: 'info',
      message: 'Consider adding referrer policy meta tag for privacy control',
    });
  }

  // ─── Score Calculation ────────────────────────────────────────────
  const weights = {
    critical: 30,
    error: 15,
    warning: 5,
    info: 0,
  };

  const deductions = issues.reduce((sum, issue) => sum + (weights[issue.severity] || 0), 0);
  let score = Math.max(0, 100 - deductions);

  // Bonus: no HTTP resources
  if (httpResources.length === 0) score = Math.min(100, score + 5);
  // Bonus: CSP present
  if (cspMeta) score = Math.min(100, score + 5);
  // Bonus: no inline event handlers
  const inlineHandlerIssues = issues.filter((i) => i.message.includes('Inline event handler'));
  if (inlineHandlerIssues.length === 0) score = Math.min(100, score + 10);

  return {
    score: Math.round(score),
    issues,
    passed: score >= 75 && !issues.some((i) => i.severity === 'critical'),
    summary: {
      inlineEventHandlerCount: issues.filter((i) => i.message.includes('Inline event handler')).length,
      hasEval: /\beval\s*\(/.test(html),
      httpResourceCount: httpResources.length,
      inlineScriptCount: inlineScripts.length,
      inlineStyleCount: inlineStyles.length,
      hasCsp: !!cspMeta,
      externalScriptCount: externalScripts.length,
      javascriptProtocolCount: links.length,
    },
  };
}

module.exports = { validateSecurity };
