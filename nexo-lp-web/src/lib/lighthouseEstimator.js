/**
 * Lighthouse Score Estimator
 * Estimates Lighthouse scores by analyzing HTML content
 */

export function estimateLighthouseScores(html) {
  if (!html || html.length === 0) {
    return getDefaultScores();
  }

  const scores = {
    performance: estimatePerformance(html),
    accessibility: estimateAccessibility(html),
    bestPractices: estimateBestPractices(html),
    seo: estimateSEO(html),
  };

  // Calculate overall average
  scores.overall = Math.round(
    (scores.performance + scores.accessibility + scores.bestPractices + scores.seo) / 4
  );

  return scores;
}

function estimatePerformance(html) {
  let score = 70; // Base score

  // Check for image optimization hints
  const imgCount = (html.match(/<img/g) || []).length;
  const lazyLoaded = (html.match(/loading\s*=\s*["']lazy["']/gi) || []).length;
  if (imgCount > 0 && lazyLoaded / imgCount > 0.5) {
    score += 8;
  }

  // Check for external resources (fewer = better)
  const externalScripts = (html.match(/<script[^>]+src/gi) || []).length;
  if (externalScripts <= 3) score += 5;
  else if (externalScripts > 10) score -= 10;

  // Inline styles are bad for caching
  const inlineStyles = (html.match(/style\s*=/gi) || []).length;
  if (inlineStyles > 20) score -= 5;

  // Check for preload/prefetch
  if (html.includes('rel="preload"')) score += 5;
  if (html.includes('rel="prefetch"')) score += 3;

  // Check for responsive images
  if (html.includes('srcset')) score += 5;

  // Check for proper meta viewport
  if (html.match(/<meta[^>]*viewport/i)) score += 5;

  // Check for render-blocking resources
  const headScripts = (html.match(/<head[^>]*>[\s\S]*?<script/gi) || []).length;
  if (headScripts > 2) score -= 5;

  // Large HTML size penalty
  if (html.length > 100000) score -= 10;
  if (html.length > 50000) score -= 5;

  return clamp(score);
}

function estimateAccessibility(html) {
  let score = 65; // Base score

  // Check for alt attributes on images
  const images = (html.match(/<img[^>]*>/gi) || []);
  const imagesWithAlt = images.filter(img => img.includes('alt='));
  if (images.length > 0) {
    const ratio = imagesWithAlt.length / images.length;
    score += Math.round(ratio * 15);
  }

  // Check for ARIA attributes
  if (html.includes('aria-') || html.includes('role=')) score += 10;

  // Check for semantic HTML
  const semanticTags = ['header', 'nav', 'main', 'article', 'section', 'aside', 'footer'];
  semanticTags.forEach(tag => {
    if (html.includes(`<${tag}`)) score += 2;
  });

  // Check for heading hierarchy
  if (html.includes('<h1')) score += 5;
  if (html.includes('<h2')) score += 3;

  // Check for form labels
  const inputs = (html.match(/<input/gi) || []).length;
  const labels = (html.match(/<label/gi) || []).length;
  if (inputs > 0 && labels >= inputs) score += 5;

  // Check for lang attribute
  if (html.match(/<html[^>]*lang\s*=/i)) score += 5;

  // Check for title
  if (html.includes('<title>')) score += 3;

  // Check for skip links
  if (html.includes('skip') && html.includes('#main')) score += 5;

  // Penalize for tables used for layout
  const tables = (html.match(/<table/gi) || []).length;
  if (tables > 0 && !html.includes('<th')) score -= 10;

  return clamp(score);
}

function estimateBestPractices(html) {
  let score = 75; // Base score

  // Check for HTTPS references
  if (html.includes('http://') && !html.includes('https://')) {
    score -= 10;
  }

  // Check for doctype
  if (html.includes('<!DOCTYPE') || html.includes('<!doctype')) {
    score += 5;
  }

  // Check for meta charset
  if (html.match(/<meta[^>]*charset/i)) score += 5;

  // Check for XSS protection headers in meta
  if (html.match(/<meta[^>]*Content-Security-Policy/i)) score += 5;

  // Check for proper favicon
  if (html.includes('favicon') || html.includes('rel="icon"')) score += 3;

  // Check for no deprecated tags
  const deprecatedTags = ['<center>', '<font', '<marquee', '<blink'];
  deprecatedTags.forEach(tag => {
    if (html.toLowerCase().includes(tag)) score -= 5;
  });

  // Check for proper viewport meta
  if (html.match(/<meta[^>]*viewport[^>]*width\s*=\s*device-width/i)) score += 5;

  // Check for proper link targets (security)
  const externalLinks = (html.match(/target\s*=\s*["']_blank["']/gi) || []).length;
  const linksWithRel = (html.match(/target\s*=\s*["']_blank["'][^>]*rel\s*=\s*["'][^"]*noopener/gi) || []).length;
  if (externalLinks > 0 && linksWithRel < externalLinks) {
    score -= 5;
  }

  // Check for noscript tag
  if (html.includes('<noscript>')) score += 3;

  return clamp(score);
}

function estimateSEO(html) {
  let score = 60; // Base score

  // Check for title
  const titleMatch = html.match(/<title>(.*?)<\/title>/i);
  if (titleMatch) {
    const title = titleMatch[1];
    if (title.length > 10 && title.length < 70) score += 10;
    else score += 5;
  }

  // Check for meta description
  const descMatch = html.match(/<meta[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["']([^"]*)["']/i)
    || html.match(/<meta[^>]*content\s*=\s*["']([^"]*)["'][^>]*name\s*=\s*["']description["']/i);
  if (descMatch) {
    const desc = descMatch[1];
    if (desc.length > 50 && desc.length < 160) score += 10;
    else score += 5;
  }

  // Check for canonical link
  if (html.includes('canonical')) score += 5;

  // Check for Open Graph tags
  if (html.includes('og:') || html.includes('og:title')) score += 5;

  // Check for Twitter cards
  if (html.includes('twitter:')) score += 3;

  // Check for structured data
  if (html.includes('application/ld+json') || html.includes('schema.org')) score += 8;

  // Check for proper heading structure
  if (html.includes('<h1')) score += 5;

  // Check for robots meta
  if (html.match(/<meta[^>]*name\s*=\s*["']robots["']/i)) score += 3;

  // Check for semantic HTML (good for SEO)
  if (html.includes('<main')) score += 3;
  if (html.includes('<article')) score += 3;
  if (html.includes('<nav')) score += 2;

  // Check for img alt (SEO benefit too)
  const images = (html.match(/<img[^>]*>/gi) || []);
  const imagesWithAlt = images.filter(img => img.includes('alt='));
  if (images.length > 0) {
    const ratio = imagesWithAlt.length / images.length;
    score += Math.round(ratio * 5);
  }

  // Check for lang attribute on html
  if (html.match(/<html[^>]*lang\s*=/i)) score += 2;

  // Check for proper URL structure in links
  const relativeLinks = (html.match(/href\s*=\s*["']\//gi) || []).length;
  if (relativeLinks > 0) score += 3;

  return clamp(score);
}

function clamp(value) {
  return Math.max(0, Math.min(100, value));
}

function getDefaultScores() {
  return {
    performance: 0,
    accessibility: 0,
    bestPractices: 0,
    seo: 0,
    overall: 0,
  };
}

/**
 * Get score color
 */
export function getScoreColor(score) {
  if (score >= 90) return '#10B981'; // emerald-500
  if (score >= 70) return '#F59E0B'; // amber-500
  if (score >= 50) return '#F97316'; // orange-500
  return '#EF4444'; // red-500
}

/**
 * Get score label
 */
export function getScoreLabel(score) {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Fair';
  return 'Poor';
}

/**
 * Get score ring color for SVG
 */
export function getScoreRingColor(score) {
  if (score >= 90) return 'text-emerald-500';
  if (score >= 70) return 'text-amber-500';
  if (score >= 50) return 'text-orange-500';
  return 'text-red-500';
}
