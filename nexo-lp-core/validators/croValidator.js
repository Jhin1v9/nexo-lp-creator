/**
 * croValidator.js — NEXO Landing Page Creator v3.0
 * Validates Conversion Rate Optimization best practices.
 * Returns: { score: 0-100, issues: [...], passed: boolean }
 */

const { JSDOM } = require('jsdom');

/**
 * Validate CRO (Conversion Rate Optimization) for an HTML document.
 * @param {string} html - Raw HTML string
 * @returns {Object} { score, issues[], passed, summary }
 */
function validateCRO(html) {
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
  const body = document.body;

  if (!body) {
    return {
      score: 0,
      issues: [{ severity: 'critical', message: 'No <body> element found' }],
      passed: false,
    };
  }

  // ─── 1. CTA Above the Fold ────────────────────────────────────────
  // Look for prominent CTA buttons near the top of the page
  const heroSection = document.querySelector('header, section:first-of-type, .hero, #hero, [class*="hero"]');
  const ctas = document.querySelectorAll('a[class*="cta"], button[class*="cta"], a.btn, button.btn, a[class*="button"], button[class*="button"]');
  
  let hasCtaAboveFold = false;
  if (heroSection) {
    const heroCtas = heroSection.querySelectorAll('a, button');
    hasCtaAboveFold = Array.from(heroCtas).some((el) => {
      const text = el.textContent.toLowerCase();
      return /(get started|sign up|try|buy|subscribe|download|learn more|start|join|claim|get)/.test(text);
    });
  }

  // Also check first viewport (first section) for any action-oriented buttons
  const firstSection = document.querySelector('section, header');
  if (firstSection && !hasCtaAboveFold) {
    const buttons = firstSection.querySelectorAll('a, button');
    hasCtaAboveFold = Array.from(buttons).some((el) => {
      const text = el.textContent.toLowerCase();
      return /(get|start|try|buy|sign|join|download|subscribe|learn)/.test(text);
    });
  }

  if (!hasCtaAboveFold) {
    issues.push({
      severity: 'critical',
      message: 'No clear CTA found in the hero/above-the-fold area',
      selector: 'header, section:first-of-type',
    });
  }

  // ─── 2. Primary CTA Visibility ────────────────────────────────────
  // Check if at least one CTA uses high-contrast styling
  let hasPrimaryCta = false;
  ctas.forEach((cta, idx) => {
    const className = (cta.getAttribute('class') || '').toLowerCase();
    if (/primary|cta-main|btn-primary|highlight/.test(className)) {
      hasPrimaryCta = true;
    }
  });

  // Check for action words in any buttons
  const allButtons = document.querySelectorAll('a, button');
  let actionButtonCount = 0;
  const actionWords = ['get', 'start', 'try', 'buy', 'sign', 'join', 'download', 'subscribe', 'claim', 'register'];
  allButtons.forEach((btn) => {
    const text = btn.textContent.toLowerCase().trim();
    if (actionWords.some((word) => text.includes(word))) {
      actionButtonCount++;
    }
  });

  if (actionButtonCount === 0) {
    issues.push({
      severity: 'critical',
      message: 'No action-oriented CTA buttons found (e.g., "Get Started", "Sign Up")',
      selector: 'a, button',
    });
  }

  // ─── 3. Social Proof ──────────────────────────────────────────────
  const testimonials = document.querySelectorAll('[class*="testimonial"], [class*="review"]');
  const trustLogos = document.querySelectorAll('[class*="logo"], [class*="trust"]');
  const clientMentions = document.querySelectorAll('[class*="client"], [class*="customer"]');
  const hasSocialProof = testimonials.length > 0 || trustLogos.length > 0 || clientMentions.length > 0;

  if (!hasSocialProof) {
    issues.push({
      severity: 'error',
      message: 'No social proof section found — add testimonials, client logos, or trust badges',
      selector: '[class*="testimonial"], [class*="logo"]',
    });
  }

  // ─── 4. Trust Signals ─────────────────────────────────────────────
  const trustSignals = document.querySelectorAll('[class*="secure"], [class*="guarantee"], [class*="trust"], [class*="safety"]');
  const sslMention = html.toLowerCase().includes('secure') || html.toLowerCase().includes('ssl') || html.toLowerCase().includes('encrypted');
  const moneyBack = html.toLowerCase().includes('money back') || html.toLowerCase().includes('guarantee');

  if (trustSignals.length === 0 && !sslMention && !moneyBack) {
    issues.push({
      severity: 'warning',
      message: 'No trust signals found — consider adding security badges, guarantees, or certifications',
    });
  }

  // ─── 5. Minimal Form Fields ───────────────────────────────────────
  const forms = document.querySelectorAll('form');
  forms.forEach((form, idx) => {
    const inputs = form.querySelectorAll('input:not([type="hidden"]):not([type="submit"]), textarea, select');
    if (inputs.length > 5) {
      issues.push({
        severity: 'warning',
        message: `Form ${idx + 1} has ${inputs.length} fields — consider reducing to improve conversion`,
        selector: `form:nth-of-type(${idx + 1})`,
      });
    }
    // Check for required field indicators
    const requiredFields = form.querySelectorAll('[required]');
    if (requiredFields.length === inputs.length && inputs.length > 0) {
      issues.push({
        severity: 'info',
        message: `All ${inputs.length} form fields are required — consider making optional fields`,
        selector: `form:nth-of-type(${idx + 1})`,
      });
    }
  });

  // ─── 6. Value Proposition Clarity ─────────────────────────────────
  const h1 = document.querySelector('h1');
  const h2s = document.querySelectorAll('h2');
  let hasValueProposition = false;
  let valuePropText = '';

  if (h1) {
    const h1Text = h1.textContent.toLowerCase();
    // Check if H1 describes value/benefit
    if (/(boost|grow|increase|improve|save|maximize|unlock|transform|build|create|launch|scale|drive|get|achieve|earn|learn|discover|start|best|fast|easy|simple|powerful|free)/.test(h1Text)) {
      hasValueProposition = true;
      valuePropText = h1.textContent.trim();
    }
  }

  if (!hasValueProposition && h2s.length > 0) {
    h2s.forEach((h2) => {
      const text = h2.textContent.toLowerCase();
      if (/(boost|grow|increase|improve|save|maximize|unlock|transform|build|create|launch|scale|drive|get|achieve|earn|learn|discover|start|best|fast|easy|simple|powerful|free)/.test(text)) {
        hasValueProposition = true;
        if (!valuePropText) valuePropText = h2.textContent.trim();
      }
    });
  }

  if (!hasValueProposition) {
    issues.push({
      severity: 'error',
      message: 'Value proposition not clear — headings should highlight benefits, not just features',
      selector: 'h1, h2',
    });
  }

  // ─── 7. Pricing Visibility ────────────────────────────────────────
  const pricingSection = document.querySelector('[class*="pric"], [id*="pric"]');
  if (!pricingSection) {
    issues.push({
      severity: 'info',
      message: 'No pricing section found — consider adding transparent pricing to increase trust',
    });
  }

  // ─── 8. Urgency / Scarcity ────────────────────────────────────────
  const hasUrgency = /(limited|urgency|countdown|timer|deadline|hurry|now|today only|last chance)/.test(html.toLowerCase());
  if (!hasUrgency) {
    issues.push({
      severity: 'info',
      message: 'Consider adding urgency elements (countdown, limited offer) to drive conversion',
    });
  }

  // ─── 9. Risk Reversal ─────────────────────────────────────────────
  const hasRiskReversal = /(money.back|guarantee|refund|risk.free|cancel.anytime|no obligation|try free)/.test(html.toLowerCase());
  if (!hasRiskReversal) {
    issues.push({
      severity: 'info',
      message: 'Consider adding risk reversal (money-back guarantee, free trial) to reduce friction',
    });
  }

  // ─── 10. Contact / Support Access ─────────────────────────────────
  const hasContact = document.querySelector('[class*="contact"], [id*="contact"], a[href*="mailto"], a[href*="tel"]');
  if (!hasContact) {
    issues.push({
      severity: 'info',
      message: 'Add visible contact information or support link to build trust',
    });
  }

  // ─── 11. Mobile Responsiveness Meta ───────────────────────────────
  const viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport) {
    issues.push({
      severity: 'error',
      message: 'Missing viewport meta tag — page may not be mobile-friendly, hurting conversion',
      selector: 'meta[name="viewport"]',
    });
  }

  // ─── 12. Navigation Clarity ───────────────────────────────────────
  const nav = document.querySelector('nav');
  if (nav) {
    const navLinks = nav.querySelectorAll('a');
    if (navLinks.length > 7) {
      issues.push({
        severity: 'info',
        message: `Navigation has ${navLinks.length} items — consider simplifying to reduce decision paralysis`,
        selector: 'nav',
      });
    }
  }

  // ─── Score Calculation ────────────────────────────────────────────
  const weights = {
    critical: 30,
    error: 12,
    warning: 5,
    info: 0,
  };

  const deductions = issues.reduce((sum, issue) => sum + (weights[issue.severity] || 0), 0);
  let score = Math.max(0, 100 - deductions);

  // Bonuses
  if (hasCtaAboveFold) score = Math.min(100, score + 10);
  if (actionButtonCount >= 2) score = Math.min(100, score + 5);
  if (testimonials.length > 0) score = Math.min(100, score + 5);
  if (trustSignals.length > 0 || sslMention || moneyBack) score = Math.min(100, score + 5);
  if (hasValueProposition) score = Math.min(100, score + 10);

  return {
    score: Math.round(score),
    issues,
    passed: score >= 60 && !issues.some((i) => i.severity === 'critical'),
    summary: {
      hasCtaAboveFold,
      actionButtonCount,
      testimonialCount: testimonials.length,
      trustSignalCount: trustSignals.length,
      formCount: forms.length,
      hasValueProposition,
      hasPricing: !!pricingSection,
      hasUrgency,
      hasRiskReversal,
    },
  };
}

module.exports = { validateCRO };
