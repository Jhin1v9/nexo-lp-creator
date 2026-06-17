/**
 * htmlExtractor.js — NEXO Landing Page Creator v3.0
 * Extracts section structure, design tokens, components, headings, images, and CTAs from HTML.
 * Returns: structured inventory of the landing page.
 */

const { JSDOM } = require('jsdom');

/**
 * Extract comprehensive information from an HTML document.
 * @param {string} html - Raw HTML string
 * @returns {Object} Extracted data structure
 */
function extractFromHTML(html) {
  if (!html || typeof html !== 'string') {
    return { error: 'Invalid HTML input' };
  }

  const dom = new JSDOM(html);
  const document = dom.window.document;

  return {
    structure: extractStructure(document),
    designTokens: extractDesignTokens(html),
    components: extractComponents(document),
    headings: extractHeadings(document),
    images: extractImages(document),
    ctas: extractCTAs(document),
    forms: extractForms(document),
    links: extractLinks(document),
    scripts: extractScripts(document),
    meta: extractMeta(document),
    navigation: extractNavigation(document),
  };
}

// ─── Section Structure ──────────────────────────────────────────────
function extractStructure(document) {
  const sections = [];
  const sectionElements = document.querySelectorAll('section, header, footer, main, article, aside');

  sectionElements.forEach((el, idx) => {
    const id = el.getAttribute('id') || null;
    const classList = Array.from(el.classList);
    const tagName = el.tagName.toLowerCase();
    const childCount = el.querySelectorAll('*').length;

    sections.push({
      index: idx,
      tag: tagName,
      id,
      classes: classList,
      elementCount: childCount,
      hasId: !!id,
      hasClasses: classList.length > 0,
    });
  });

  const landmarks = {
    header: document.querySelectorAll('header').length,
    nav: document.querySelectorAll('nav').length,
    main: document.querySelectorAll('main').length,
    section: document.querySelectorAll('section').length,
    article: document.querySelectorAll('article').length,
    aside: document.querySelectorAll('aside').length,
    footer: document.querySelectorAll('footer').length,
  };

  return {
    landmarks,
    sectionCount: sections.length,
    sections,
  };
}

// ─── Design Tokens (colors, fonts, spacing from inline styles) ──────
function extractDesignTokens(html) {
  const tokens = {
    colors: new Set(),
    fontFamilies: new Set(),
    fontSizes: new Set(),
    spacing: new Set(),
    borderRadius: new Set(),
    shadows: new Set(),
  };

  // Extract hex colors
  const hexRegex = /#[0-9a-fA-F]{3,8}\b/g;
  const hexMatches = html.match(hexRegex) || [];
  hexMatches.forEach((c) => tokens.colors.add(c.toLowerCase()));

  // Extract rgb/rgba colors
  const rgbRegex = /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)/gi;
  const rgbMatches = html.match(rgbRegex) || [];
  rgbMatches.forEach((c) => tokens.colors.add(c.toLowerCase()));

  // Extract hsl/hsla colors
  const hslRegex = /hsla?\(\s*\d+\s*,\s*\d+%?\s*,\s*\d+%?\s*(?:,\s*[\d.]+\s*)?\)/gi;
  const hslMatches = html.match(hslRegex) || [];
  hslMatches.forEach((c) => tokens.colors.add(c.toLowerCase()));

  // Extract Tailwind color classes
  const tailwindColorRegex = /(bg|text|border|ring)-([a-z]+)-(50|100|200|300|400|500|600|700|800|900|950)/gi;
  const twMatches = html.match(tailwindColorRegex) || [];
  twMatches.forEach((c) => tokens.colors.add(c.toLowerCase()));

  // Extract font-family declarations
  const fontRegex = /font-family\s*:\s*([^;{}]+)/gi;
  const fontMatches = html.match(fontRegex) || [];
  fontMatches.forEach((f) => {
    const clean = f.replace(/font-family\s*:\s*/, '').trim();
    tokens.fontFamilies.add(clean);
  });

  // Extract Tailwind font classes
  const fontClassRegex = /font-(sans|serif|mono)/gi;
  const fontClassMatches = html.match(fontClassRegex) || [];
  fontClassMatches.forEach((f) => tokens.fontFamilies.add(f.toLowerCase()));

  // Extract font sizes (Tailwind)
  const fontSizeRegex = /text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)/gi;
  const fontSizeMatches = html.match(fontSizeRegex) || [];
  fontSizeMatches.forEach((s) => tokens.fontSizes.add(s.toLowerCase()));

  // Extract spacing classes (Tailwind)
  const spacingRegex = /[mp][trblxy]?-(\d+|px|auto|full)/gi;
  const spacingMatches = html.match(spacingRegex) || [];
  // Take a sample to avoid overwhelming output
  spacingMatches.slice(0, 50).forEach((s) => tokens.spacing.add(s.toLowerCase()));

  // Extract border radius
  const radiusRegex = /rounded(-[a-z]+)?(-\d+)?/gi;
  const radiusMatches = html.match(radiusRegex) || [];
  radiusMatches.slice(0, 30).forEach((r) => tokens.borderRadius.add(r.toLowerCase()));

  // Extract shadows
  const shadowRegex = /shadow(-[a-z]+)?/gi;
  const shadowMatches = html.match(shadowRegex) || [];
  shadowMatches.forEach((s) => tokens.shadows.add(s.toLowerCase()));

  return {
    colors: Array.from(tokens.colors),
    fontFamilies: Array.from(tokens.fontFamilies),
    fontSizes: Array.from(tokens.fontSizes),
    spacing: Array.from(tokens.spacing),
    borderRadius: Array.from(tokens.borderRadius),
    shadows: Array.from(tokens.shadows),
  };
}

// ─── Component Inventory ────────────────────────────────────────────
function extractComponents(document) {
  const components = [];

  // Cards
  const cards = document.querySelectorAll('[class*="card"], .card');
  cards.forEach((card, idx) => {
    components.push({
      type: 'card',
      index: idx,
      classes: Array.from(card.classList),
      childCount: card.querySelectorAll('*').length,
    });
  });

  // Buttons
  const buttons = document.querySelectorAll('button, a[class*="btn"], [class*="button"]');
  buttons.forEach((btn, idx) => {
    components.push({
      type: 'button',
      index: idx,
      tag: btn.tagName.toLowerCase(),
      text: btn.textContent.trim().substring(0, 50),
      classes: Array.from(btn.classList),
    });
  });

  // Forms
  const forms = document.querySelectorAll('form');
  forms.forEach((form, idx) => {
    components.push({
      type: 'form',
      index: idx,
      classes: Array.from(form.classList),
      inputCount: form.querySelectorAll('input, textarea, select').length,
    });
  });

  // Navigation
  const navs = document.querySelectorAll('nav');
  navs.forEach((nav, idx) => {
    components.push({
      type: 'navigation',
      index: idx,
      linkCount: nav.querySelectorAll('a').length,
      classes: Array.from(nav.classList),
    });
  });

  // Hero section
  const heroes = document.querySelectorAll('[class*="hero"], [id*="hero"]');
  heroes.forEach((hero, idx) => {
    components.push({
      type: 'hero',
      index: idx,
      classes: Array.from(hero.classList),
      id: hero.getAttribute('id'),
    });
  });

  // Modals / Overlays
  const modals = document.querySelectorAll('[class*="modal"], [class*="overlay"], [class*="popup"]');
  modals.forEach((modal, idx) => {
    components.push({
      type: 'modal',
      index: idx,
      classes: Array.from(modal.classList),
    });
  });

  // Carousels / Sliders
  const carousels = document.querySelectorAll('[class*="carousel"], [class*="slider"], [class*="swiper"]');
  carousels.forEach((c, idx) => {
    components.push({
      type: 'carousel',
      index: idx,
      classes: Array.from(c.classList),
    });
  });

  return {
    count: components.length,
    byType: groupByType(components),
    list: components,
  };
}

function groupByType(components) {
  const grouped = {};
  components.forEach((c) => {
    if (!grouped[c.type]) grouped[c.type] = [];
    grouped[c.type].push(c);
  });
  return grouped;
}

// ─── Heading Hierarchy ──────────────────────────────────────────────
function extractHeadings(document) {
  const headings = [];
  const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');

  headingElements.forEach((el, idx) => {
    headings.push({
      index: idx,
      level: parseInt(el.tagName[1], 10),
      text: el.textContent.trim().substring(0, 100),
      classes: Array.from(el.classList),
      id: el.getAttribute('id') || null,
    });
  });

  const h1Count = headings.filter((h) => h.level === 1).length;
  const h2Count = headings.filter((h) => h.level === 2).length;

  return {
    count: headings.length,
    h1Count,
    h2Count,
    hierarchy: checkHierarchy(headings),
    headings,
  };
}

function checkHierarchy(headings) {
  const issues = [];
  let prevLevel = 0;
  headings.forEach((h, idx) => {
    if (h.level > prevLevel + 1 && prevLevel !== 0) {
      issues.push({
        index: idx,
        from: `H${prevLevel}`,
        to: `H${h.level}`,
        text: h.text.substring(0, 50),
      });
    }
    prevLevel = h.level;
  });
  return {
    valid: issues.length === 0,
    skipIssues: issues,
  };
}

// ─── Image Inventory ────────────────────────────────────────────────
function extractImages(document) {
  const images = [];
  const imgElements = document.querySelectorAll('img');

  imgElements.forEach((img, idx) => {
    images.push({
      index: idx,
      src: img.getAttribute('src') || null,
      alt: img.getAttribute('alt') || null,
      width: img.getAttribute('width') || null,
      height: img.getAttribute('height') || null,
      loading: img.getAttribute('loading') || null,
      classes: Array.from(img.classList),
      hasAlt: img.hasAttribute('alt') && img.getAttribute('alt').trim() !== '',
      isLazyLoaded: img.getAttribute('loading') === 'lazy',
    });
  });

  return {
    count: images.length,
    withAlt: images.filter((i) => i.hasAlt).length,
    lazyLoaded: images.filter((i) => i.isLazyLoaded).length,
    withoutDimensions: images.filter((i) => !i.width || !i.height).length,
    images,
  };
}

// ─── CTA Elements ───────────────────────────────────────────────────
function extractCTAs(document) {
  const ctas = [];
  const actionWords = [
    'get', 'start', 'try', 'buy', 'sign', 'join', 'download',
    'subscribe', 'claim', 'register', 'learn', 'contact', 'call',
    'book', 'schedule', 'order', 'shop', 'demo', 'trial',
  ];

  const allLinks = document.querySelectorAll('a, button');
  allLinks.forEach((el, idx) => {
    const text = el.textContent.toLowerCase().trim();
    const isAction = actionWords.some((word) => text.includes(word));

    if (isAction) {
      ctas.push({
        index: idx,
        tag: el.tagName.toLowerCase(),
        text: el.textContent.trim().substring(0, 60),
        href: el.tagName.toLowerCase() === 'a' ? el.getAttribute('href') : null,
        classes: Array.from(el.classList),
        isButton: el.tagName.toLowerCase() === 'button',
        isLink: el.tagName.toLowerCase() === 'a',
      });
    }
  });

  return {
    count: ctas.length,
    ctas,
  };
}

// ─── Form Inventory ─────────────────────────────────────────────────
function extractForms(document) {
  const forms = [];
  const formElements = document.querySelectorAll('form');

  formElements.forEach((form, idx) => {
    const inputs = form.querySelectorAll('input, textarea, select');
    const inputList = Array.from(inputs).map((input) => ({
      type: input.getAttribute('type') || input.tagName.toLowerCase(),
      name: input.getAttribute('name') || null,
      required: input.hasAttribute('required'),
      placeholder: input.getAttribute('placeholder') || null,
    }));

    forms.push({
      index: idx,
      action: form.getAttribute('action') || null,
      method: form.getAttribute('method') || 'get',
      inputCount: inputs.length,
      hasSubmitButton: form.querySelector('button[type="submit"], input[type="submit"]') !== null,
      inputs: inputList,
    });
  });

  return {
    count: forms.length,
    forms,
  };
}

// ─── Link Inventory ─────────────────────────────────────────────────
function extractLinks(document) {
  const links = [];
  const linkElements = document.querySelectorAll('a[href]');

  linkElements.forEach((link, idx) => {
    const href = link.getAttribute('href');
    links.push({
      index: idx,
      href,
      text: link.textContent.trim().substring(0, 50),
      isExternal: href && (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//')),
      isMailto: href && href.startsWith('mailto:'),
      isTel: href && href.startsWith('tel:'),
      classes: Array.from(link.classList),
    });
  });

  return {
    count: links.length,
    internal: links.filter((l) => !l.isExternal).length,
    external: links.filter((l) => l.isExternal).length,
    links,
  };
}

// ─── Script Inventory ───────────────────────────────────────────────
function extractScripts(document) {
  const scripts = [];
  const scriptElements = document.querySelectorAll('script');

  scriptElements.forEach((script, idx) => {
    const src = script.getAttribute('src');
    scripts.push({
      index: idx,
      src: src || null,
      isInline: !src,
      isAsync: script.hasAttribute('async'),
      isDefer: script.hasAttribute('defer'),
      isModule: script.getAttribute('type') === 'module',
      type: script.getAttribute('type') || 'text/javascript',
      contentLength: src ? 0 : script.textContent.length,
    });
  });

  return {
    count: scripts.length,
    inline: scripts.filter((s) => s.isInline).length,
    external: scripts.filter((s) => !s.isInline).length,
    asyncCount: scripts.filter((s) => s.isAsync).length,
    deferCount: scripts.filter((s) => s.isDefer).length,
    scripts,
  };
}

// ─── Meta Tags ──────────────────────────────────────────────────────
function extractMeta(document) {
  const metaTags = document.querySelectorAll('meta');
  const meta = {};

  metaTags.forEach((tag) => {
    const name = tag.getAttribute('name');
    const property = tag.getAttribute('property');
    const charset = tag.getAttribute('charset');
    const httpEquiv = tag.getAttribute('http-equiv');
    const content = tag.getAttribute('content');
    const key = name || property || charset || httpEquiv || 'unknown';

    if (key !== 'unknown') {
      meta[key] = content || charset || '';
    }
  });

  return {
    title: document.querySelector('title')?.textContent || null,
    description: meta.description || null,
    charset: meta.charset || null,
    viewport: meta.viewport || null,
    allMeta: meta,
  };
}

// ─── Navigation Structure ───────────────────────────────────────────
function extractNavigation(document) {
  const navs = document.querySelectorAll('nav');
  const navItems = [];

  navs.forEach((nav, navIdx) => {
    const links = nav.querySelectorAll('a');
    links.forEach((link, linkIdx) => {
      navItems.push({
        navIndex: navIdx,
        linkIndex: linkIdx,
        text: link.textContent.trim().substring(0, 50),
        href: link.getAttribute('href'),
        isActive: link.classList.contains('active') || link.getAttribute('aria-current') === 'page',
      });
    });
  });

  return {
    navCount: navs.length,
    totalNavLinks: navItems.length,
    items: navItems,
  };
}

module.exports = { extractFromHTML };
