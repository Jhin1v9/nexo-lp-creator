/**
 * constants.js — NEXO Landing Page Creator v3.0
 * All project-wide constants in one place.
 */

// ─── Token Costs (per operation) ──────────────────────────────────
const TOKEN_COSTS = {
  HTML_GENERATION_PER_SECTION: 800,
  VALIDATION_RUN: 200,
  PLACEHOLDER_REPLACEMENT: 50,
  METADATA_EXTRACTION: 100,
  ZIP_GENERATION: 300,
  TEMPLATE_CUSTOMIZATION: 500,
};

// ─── Timeout Values (milliseconds) ────────────────────────────────
const TIMEOUTS = {
  HTML_GENERATION: 60000,        // 60 seconds
  VALIDATION: 15000,             // 15 seconds
  ZIP_GENERATION: 30000,         // 30 seconds
  BUILD_PROCESS: 120000,         // 2 minutes
  EXTERNAL_REQUEST: 10000,       // 10 seconds
  PLACEHOLDER_FILL: 5000,        // 5 seconds
};

// ─── Stack Identifiers ────────────────────────────────────────────
const STACKS = {
  STATIC_HTML_TAILWIND: 'static-html-tailwind',
  VITE_REACT_TAILWIND: 'vite-react-tailwind',
  VITE_VUE_TAILWIND: 'vite-vue-tailwind',
  VITE_SVELTE_TAILWIND: 'vite-svelte-tailwind',
  NEXTJS_APP_ROUTER: 'nextjs-app-router',
  NEXTJS_PAGES_ROUTER: 'nextjs-pages-router',
};

const STACK_NAMES = Object.values(STACKS);

// ─── Phase Names ──────────────────────────────────────────────────
const PHASES = {
  INIT: 'init',
  REQUIREMENTS: 'requirements',
  DESIGN: 'design',
  GENERATE: 'generate',
  VALIDATE: 'validate',
  REFINE: 'refine',
  BUILD: 'build',
  DEPLOY: 'deploy',
  DONE: 'done',
};

const PHASE_ORDER = [
  PHASES.INIT,
  PHASES.REQUIREMENTS,
  PHASES.DESIGN,
  PHASES.GENERATE,
  PHASES.VALIDATE,
  PHASES.REFINE,
  PHASES.BUILD,
  PHASES.DEPLOY,
  PHASES.DONE,
];

// ─── Validation Dimensions ────────────────────────────────────────
const DIMENSIONS = {
  CODE: 'code',
  SEO: 'seo',
  CRO: 'cro',
  SECURITY: 'security',
  BUILD: 'build',
  PERFORMANCE: 'performance',
};

const DIMENSION_NAMES = Object.values(DIMENSIONS);

// ─── Severity Levels ──────────────────────────────────────────────
const SEVERITY = {
  CRITICAL: 'critical',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
};

// ─── Score Weights for Overall Calculation ────────────────────────
const SCORE_WEIGHTS = {
  [DIMENSIONS.CODE]: 1.0,
  [DIMENSIONS.SEO]: 1.0,
  [DIMENSIONS.CRO]: 0.8,
  [DIMENSIONS.SECURITY]: 1.2,
  [DIMENSIONS.BUILD]: 1.0,
  [DIMENSIONS.PERFORMANCE]: 0.8,
};

// ─── Quality Gate Thresholds ──────────────────────────────────────
const QUALITY_GATES = {
  MIN_OVERALL_SCORE: 75,
  MAX_CRITICAL_ISSUES: 0,
  MAX_TOTAL_ISSUES: 15,
  MIN_DIMENSIONS_PASSED: 4,
  DIMENSION_PASS_THRESHOLD: 60,
};

// ─── Placeholder Defaults ─────────────────────────────────────────
const PLACEHOLDER_DEFAULTS = {
  BRAND_NAME: 'Your Brand',
  TAGLINE: 'Transform Your Business',
  META_DESCRIPTION: 'Discover how we can help you achieve more with less effort.',
  HERO_HEADLINE: 'Build Something',
  HERO_HEADLINE_HIGHLIGHT: 'Amazing Today',
  HERO_SUBHEADLINE: 'Join thousands of satisfied customers.',
  HERO_CTA_PRIMARY: 'Get Started Free',
  HERO_CTA_SECONDARY: 'Learn More',
  CTA_HEADLINE: 'Ready to Get Started?',
  CTA_BUTTON_PRIMARY: 'Start Free Trial',
  NAV_FEATURES: 'Features',
  NAV_PRICING: 'Pricing',
  NAV_TESTIMONIALS: 'Testimonials',
  FEATURES_TITLE: 'Everything You Need',
  CURRENT_YEAR: new Date().getFullYear().toString(),
};

// ─── File Paths ───────────────────────────────────────────────────
const PATHS = {
  BASE: 'nexo-lp-core',
  VALIDATORS: 'validators',
  PARSERS: 'parsers',
  GENERATORS: 'generators',
  STACKS: 'stacks',
  QUALITY_GATES: 'quality-gates',
  TEMPLATES: 'templates',
  SEED_TEMPLATES: 'templates/seed',
  OUTPUT: 'output',
};

// ─── Supported Image Formats ──────────────────────────────────────
const IMAGE_FORMATS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif'];

// ─── HTML Meta Tags Defaults ──────────────────────────────────────
const META_DEFAULTS = {
  CHARSET: 'UTF-8',
  VIEWPORT: 'width=device-width, initial-scale=1.0',
  ROBOTS: 'index, follow',
  THEME_COLOR: '#0f172a',
  OG_TYPE: 'website',
  TWITTER_CARD: 'summary_large_image',
};

// ─── Version ──────────────────────────────────────────────────────
const VERSION = '3.0.0';

module.exports = {
  TOKEN_COSTS,
  TIMEOUTS,
  STACKS,
  STACK_NAMES,
  PHASES,
  PHASE_ORDER,
  DIMENSIONS,
  DIMENSION_NAMES,
  SEVERITY,
  SCORE_WEIGHTS,
  QUALITY_GATES,
  PLACEHOLDER_DEFAULTS,
  PATHS,
  IMAGE_FORMATS,
  META_DEFAULTS,
  VERSION,
};
