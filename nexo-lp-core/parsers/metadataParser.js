/**
 * metadataParser.js — NEXO Landing Page Creator v3.0
 * Extracts/generates metadata: title, description, keywords, category, difficulty, tags.
 * Returns: structured metadata object.
 */

const { JSDOM } = require('jsdom');

/**
 * Parse and generate metadata from an HTML document.
 * @param {string} html - Raw HTML string
 * @returns {Object} Metadata object with title, description, keywords, category, difficulty, tags
 */
function parseMetadata(html) {
  if (!html || typeof html !== 'string') {
    return {
      error: 'Invalid HTML input',
      title: null,
      description: null,
      keywords: [],
      category: null,
      difficulty: 'unknown',
      tags: [],
    };
  }

  const dom = new JSDOM(html);
  const document = dom.window.document;

  const meta = {
    // Direct extraction
    title: extractTitle(document),
    description: extractDescription(document),
    
    // Generated/derived
    keywords: generateKeywords(document),
    category: inferCategory(document),
    difficulty: inferDifficulty(document),
    tags: generateTags(document),
    
    // Technical metadata
    tech: detectTechnologies(html),
    structure: analyzeStructure(document),
    seo: analyzeSEOBasics(document),
  };

  return meta;
}

// ─── Extract Title ──────────────────────────────────────────────────
function extractTitle(document) {
  const titleTag = document.querySelector('title');
  if (titleTag && titleTag.textContent.trim()) {
    return titleTag.textContent.trim();
  }

  // Fallback: use H1 text
  const h1 = document.querySelector('h1');
  if (h1 && h1.textContent.trim()) {
    return h1.textContent.trim().substring(0, 60);
  }

  // Fallback: use first H2
  const h2 = document.querySelector('h2');
  if (h2 && h2.textContent.trim()) {
    return h2.textContent.trim().substring(0, 60);
  }

  return null;
}

// ─── Extract Description ────────────────────────────────────────────
function extractDescription(document) {
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    const content = metaDesc.getAttribute('content');
    if (content && content.trim()) {
      return content.trim();
    }
  }

  // Fallback: first paragraph text
  const firstP = document.querySelector('p');
  if (firstP && firstP.textContent.trim()) {
    return firstP.textContent.trim().substring(0, 160);
  }

  // Fallback: first 160 chars of body text
  const body = document.querySelector('body');
  if (body && body.textContent.trim()) {
    return body.textContent.trim().substring(0, 160);
  }

  return null;
}

// ─── Generate Keywords ──────────────────────────────────────────────
function generateKeywords(document) {
  const keywords = new Set();
  const html = document.documentElement.innerHTML.toLowerCase();

  // From meta keywords
  const metaKeywords = document.querySelector('meta[name="keywords"]');
  if (metaKeywords) {
    const content = metaKeywords.getAttribute('content') || '';
    content.split(',').forEach((k) => {
      const clean = k.trim().toLowerCase();
      if (clean) keywords.add(clean);
    });
  }

  // From headings
  const headings = document.querySelectorAll('h1, h2, h3');
  headings.forEach((h) => {
    const words = h.textContent.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !isStopWord(w));
    words.slice(0, 5).forEach((w) => keywords.add(w));
  });

  // From category indicators in text
  const bodyText = document.body ? document.body.textContent.toLowerCase() : '';
  const keywordMappings = [
    { terms: ['software', 'saas', 'platform', 'app', 'dashboard', 'api'], keyword: 'saas' },
    { terms: ['medical', 'clinic', 'doctor', 'health', 'patient', 'appointment'], keyword: 'healthcare' },
    { terms: ['course', 'learn', 'education', 'student', 'training', 'lesson'], keyword: 'education' },
    { terms: ['mobile', 'download', 'ios', 'android', 'app store'], keyword: 'mobile-app' },
    { terms: ['restaurant', 'food', 'menu', 'dining', 'chef'], keyword: 'restaurant' },
    { terms: ['real estate', 'property', 'house', 'apartment', 'mortgage'], keyword: 'real-estate' },
    { terms: ['fitness', 'gym', 'workout', 'exercise', 'training'], keyword: 'fitness' },
    { terms: ['agency', 'portfolio', 'creative', 'design', 'studio'], keyword: 'agency' },
    { terms: ['ecommerce', 'shop', 'store', 'product', 'cart', 'buy'], keyword: 'ecommerce' },
    { terms: ['event', 'conference', 'ticket', 'venue', 'schedule'], keyword: 'events' },
  ];

  keywordMappings.forEach(({ terms, keyword }) => {
    if (terms.some((term) => bodyText.includes(term))) {
      keywords.add(keyword);
    }
  });

  // From OG tags
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) {
    const words = (ogTitle.getAttribute('content') || '').toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3 && !isStopWord(w));
    words.slice(0, 3).forEach((w) => keywords.add(w.replace(/[^a-z0-9]/g, '')));
  }

  return Array.from(keywords).slice(0, 15);
}

// ─── Infer Category ─────────────────────────────────────────────────
function inferCategory(document) {
  const bodyText = document.body ? document.body.textContent.toLowerCase() : '';
  const title = (document.querySelector('title')?.textContent || '').toLowerCase();
  const combined = title + ' ' + bodyText;

  const categories = [
    {
      name: 'saas',
      score: countTerms(combined, ['software', 'saas', 'platform', 'cloud', 'subscription', 'dashboard', 'api', 'integration']),
    },
    {
      name: 'healthcare',
      score: countTerms(combined, ['medical', 'clinic', 'doctor', 'health', 'patient', 'appointment', 'treatment', 'care']),
    },
    {
      name: 'education',
      score: countTerms(combined, ['course', 'learn', 'education', 'student', 'lesson', 'instructor', 'certificate', 'curriculum']),
    },
    {
      name: 'mobile-app',
      score: countTerms(combined, ['app', 'download', 'ios', 'android', 'mobile', 'play store', 'app store']),
    },
    {
      name: 'ecommerce',
      score: countTerms(combined, ['shop', 'store', 'product', 'cart', 'buy', 'purchase', 'order', 'shipping']),
    },
    {
      name: 'agency',
      score: countTerms(combined, ['agency', 'portfolio', 'creative', 'design', 'studio', 'branding', 'marketing']),
    },
    {
      name: 'restaurant',
      score: countTerms(combined, ['restaurant', 'food', 'menu', 'dining', 'chef', 'cuisine', 'reservation']),
    },
    {
      name: 'real-estate',
      score: countTerms(combined, ['property', 'house', 'apartment', 'real estate', 'rent', 'mortgage', 'home']),
    },
    {
      name: 'events',
      score: countTerms(combined, ['event', 'conference', 'ticket', 'venue', 'schedule', 'speaker', 'workshop']),
    },
    {
      name: 'fitness',
      score: countTerms(combined, ['fitness', 'gym', 'workout', 'exercise', 'training', 'health', 'wellness']),
    },
    {
      name: 'nonprofit',
      score: countTerms(combined, ['donate', 'charity', 'nonprofit', 'cause', 'mission', 'volunteer', 'fundraising']),
    },
    {
      name: 'personal-brand',
      score: countTerms(combined, ['about me', 'portfolio', 'resume', 'hire me', 'freelance', 'consultant']),
    },
  ];

  categories.sort((a, b) => b.score - a.score);
  const best = categories[0];

  return best.score > 0 ? best.name : 'general';
}

// ─── Infer Difficulty Level ─────────────────────────────────────────
function inferDifficulty(document) {
  const html = document.documentElement.outerHTML;
  const lines = html.split('\n').length;
  const elements = document.querySelectorAll('*').length;
  const scripts = document.querySelectorAll('script').length;
  const styles = document.querySelectorAll('style, link[rel="stylesheet"]').length;
  const forms = document.querySelectorAll('form').length;
  const animations = (html.match(/animation|transition|keyframes|@keyframes/g) || []).length;
  const hasCarousel = html.includes('carousel') || html.includes('swiper') || html.includes('slider');

  let score = 0;
  if (elements > 100) score += 1;
  if (elements > 300) score += 1;
  if (scripts > 2) score += 1;
  if (styles > 2) score += 1;
  if (forms > 0) score += 1;
  if (animations > 5) score += 1;
  if (hasCarousel) score += 1;
  if (lines > 500) score += 1;

  if (score <= 1) return 'beginner';
  if (score <= 3) return 'intermediate';
  if (score <= 5) return 'advanced';
  return 'expert';
}

// ─── Generate Tags ──────────────────────────────────────────────────
function generateTags(document) {
  const tags = new Set();
  const html = document.documentElement.outerHTML.toLowerCase();
  const text = document.body ? document.body.textContent.toLowerCase() : '';

  // Responsive
  const hasViewport = document.querySelector('meta[name="viewport"]');
  if (hasViewport) tags.add('responsive');

  // Framework indicators
  if (html.includes('tailwind')) tags.add('tailwindcss');
  if (html.includes('bootstrap')) tags.add('bootstrap');
  if (html.includes('bulma')) tags.add('bulma');
  if (html.includes('vue.js') || html.includes('vue.min.js')) tags.add('vue');
  if (html.includes('react')) tags.add('react');
  if (html.includes('angular')) tags.add('angular');
  if (html.includes('svelte')) tags.add('svelte');

  // Animation
  if (html.includes('animate.css') || html.includes('a href="css"') || html.includes('transition') || html.includes('animation')) {
    tags.add('animated');
  }
  if (html.includes('gsap') || html.includes('scrollmagic')) {
    tags.add('advanced-animations');
  }

  // Features
  if (document.querySelector('form')) tags.add('forms');
  if (document.querySelectorAll('img').length > 3) tags.add('image-rich');
  if (html.includes('pricing') || text.includes('pricing')) tags.add('pricing-table');
  if (html.includes('testimonial') || text.includes('testimonial')) tags.add('testimonials');
  if (html.includes('faq') || text.includes('faq')) tags.add('faq');
  if (html.includes('carousel') || html.includes('slider')) tags.add('carousel');
  if (html.includes('countdown') || html.includes('timer')) tags.add('countdown');
  if (html.includes('modal') || html.includes('popup')) tags.add('modal');
  if (html.includes('video')) tags.add('video');
  if (html.includes('map') || html.includes('google maps')) tags.add('map');
  if (document.querySelectorAll('a').length > 10) tags.add('multi-page');

  // Design style
  if (html.includes('dark') || html.includes('bg-black') || html.includes('bg-gray-900')) {
    tags.add('dark-theme');
  }
  if (html.includes('gradient') || html.includes('bg-gradient')) {
    tags.add('gradient');
  }
  if (html.includes('glass') || html.includes('backdrop-blur')) {
    tags.add('glassmorphism');
  }
  if (html.includes('minimal') || html.includes('clean')) {
    tags.add('minimal');
  }

  return Array.from(tags);
}

// ─── Detect Technologies ────────────────────────────────────────────
function detectTechnologies(html) {
  const tech = [];
  const lower = html.toLowerCase();

  if (lower.includes('tailwindcss') || lower.includes('tailwind')) tech.push('tailwindcss');
  if (lower.includes('bootstrap')) tech.push('bootstrap');
  if (lower.includes('jquery')) tech.push('jquery');
  if (lower.includes('alpine')) tech.push('alpine.js');
  if (lower.includes('vue')) tech.push('vue');
  if (lower.includes('react')) tech.push('react');
  if (lower.includes('angular')) tech.push('angular');
  if (lower.includes('svelte')) tech.push('svelte');
  if (lower.includes('gsap')) tech.push('gsap');
  if (lower.includes('animate.css')) tech.push('animate.css');
  if (lower.includes('fontawesome') || lower.includes('fa-')) tech.push('font-awesome');
  if (lower.includes('googleapis.com/fonts')) tech.push('google-fonts');
  if (lower.includes('typekit')) tech.push('adobe-fonts');

  return tech;
}

// ─── Analyze Structure ──────────────────────────────────────────────
function analyzeStructure(document) {
  return {
    totalElements: document.querySelectorAll('*').length,
    sections: document.querySelectorAll('section').length,
    headings: document.querySelectorAll('h1, h2, h3, h4, h5, h6').length,
    images: document.querySelectorAll('img').length,
    links: document.querySelectorAll('a').length,
    buttons: document.querySelectorAll('button').length,
    forms: document.querySelectorAll('form').length,
    videos: document.querySelectorAll('video').length,
    tables: document.querySelectorAll('table').length,
    lists: document.querySelectorAll('ul, ol').length,
    hasHeader: document.querySelector('header') !== null,
    hasNav: document.querySelector('nav') !== null,
    hasFooter: document.querySelector('footer') !== null,
    hasMain: document.querySelector('main') !== null,
  };
}

// ─── Analyze SEO Basics ─────────────────────────────────────────────
function analyzeSEOBasics(document) {
  return {
    hasTitle: document.querySelector('title') !== null,
    hasMetaDescription: document.querySelector('meta[name="description"]') !== null,
    hasViewport: document.querySelector('meta[name="viewport"]') !== null,
    hasCharset: document.querySelector('meta[charset]') !== null,
    hasCanonical: document.querySelector('link[rel="canonical"]') !== null,
    hasOGTags: document.querySelector('meta[property^="og:"]') !== null,
    hasTwitterCards: document.querySelector('meta[name^="twitter:"]') !== null,
    hasJsonLd: document.querySelector('script[type="application/ld+json"]') !== null,
    hasFavicon: document.querySelector('link[rel~="icon"]') !== null,
    hasLang: document.querySelector('html[lang]') !== null,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────
function isStopWord(word) {
  const stopWords = new Set([
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can',
    'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has',
    'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see',
    'two', 'who', 'boy', 'did', 'she', 'use', 'her', 'way', 'many',
    'oil', 'sit', 'set', 'run', 'eat', 'far', 'sea', 'eye', 'ago',
    'off', 'too', 'any', 'try', 'ask', 'end', 'why', 'let', 'put',
    'say', 'she', 'try', 'way', 'own', 'say', 'too', 'old', 'tell',
    'with', 'have', 'this', 'will', 'your', 'from', 'they', 'know',
    'want', 'been', 'good', 'much', 'some', 'time', 'very', 'when',
    'come', 'here', 'just', 'like', 'long', 'make', 'over', 'such',
    'take', 'than', 'them', 'well', 'were', 'that', 'what', 'would',
    'there', 'their', 'about', 'could', 'other', 'after', 'first',
    'never', 'these', 'think', 'where', 'being', 'every', 'great',
    'might', 'shall', 'still', 'those', 'under', 'while', 'should',
    'really', 'through', 'before', 'around', 'because', 'without',
  ]);
  return stopWords.has(word.toLowerCase());
}

function countTerms(text, terms) {
  let count = 0;
  terms.forEach((term) => {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    const matches = text.match(regex);
    if (matches) count += matches.length;
  });
  return count;
}

module.exports = { parseMetadata };
