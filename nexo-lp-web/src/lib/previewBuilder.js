/**
 * Preview utilities.
 *
 * The live preview renders the raw generated HTML via iframe srcdoc, exactly
 * like the admin template panel. To prevent GSAP/ScrollTrigger/AOS-style
 * animations from leaving sections invisible in the preview, we inject a small
 * CSS reset that forces opacity/visibility/transform back to visible defaults.
 * Animations still play, but content is never stuck hidden.
 */

const PREVIEW_VISIBILITY_STYLE = `
/* NEXO preview visibility safeguard — ensures animated content is visible */
[data-aos],
[data-aos*="fade"],
[data-aos*="zoom"],
[data-aos*="slide"],
[data-gsap],
[data-scroll-trigger],
.gsap-marker,
.animate-on-scroll,
.reveal,
.fade-in,
.slide-up,
.zoom-in,
.section-reveal,
.counter-number,
.wow,
.animate__animated,
.animate__fadeIn,
.animate__fadeInUp,
.animate__fadeInDown,
.animate__zoomIn,
.animate__slideInUp,
.fade,
.hidden,
.invisible,
.opacity-0 {
  opacity: 1 !important;
  visibility: visible !important;
  transform: none !important;
  filter: none !important;
  clip-path: none !important;
  mask: none !important;
  -webkit-mask: none !important;
}

/* If any element starts with opacity 0 via inline style, make it visible */
[style*="opacity: 0"],
[style*="opacity:0"] {
  opacity: 1 !important;
}

[style*="visibility: hidden"],
[style*="visibility:hidden"] {
  visibility: visible !important;
}
`;

/**
 * Prepare raw generated HTML for safe preview rendering.
 * Injects a visibility safeguard into the <head> without altering the body.
 */
export function preparePreviewHtml(html) {
  if (!html || typeof html !== 'string') return html;
  if (!html.includes('<')) return html;

  const styleTag = `<style>${PREVIEW_VISIBILITY_STYLE}</style>`;

  // If there's a <head>, inject before </head>
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${styleTag}</head>`);
  }

  // If there's an <html>, inject after <html>
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/(<html[^>]*>)/i, `$1<head>${styleTag}</head>`);
  }

  // Fallback: prepend a minimal head
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">${styleTag}</head><body>${html}</body></html>`;
}

/**
 * Check if HTML has a valid structure
 */
export function validateHtml(html) {
  const issues = [];

  if (!html || html.trim().length === 0) {
    issues.push({ type: 'error', message: 'HTML is empty' });
    return { valid: false, issues };
  }

  if (!html.includes('<')) {
    issues.push({ type: 'error', message: 'No HTML tags found' });
  }

  const openTags = (html.match(/<\w+[\s>]/g) || []).length;
  const closeTags = (html.match(/<\/\w+>/g) || []).length;
  const selfClosing = (html.match(/<(br|hr|img|input|meta|link|area|base|col|embed|param|source|track|wbr)[\s>]/g) || []).length;

  if (openTags > closeTags + selfClosing) {
    issues.push({ type: 'warning', message: 'Potentially unclosed tags detected' });
  }

  if (!html.includes('<!DOCTYPE') && !html.includes('<!doctype')) {
    issues.push({ type: 'info', message: 'Missing DOCTYPE declaration' });
  }

  if (!html.includes('<title')) {
    issues.push({ type: 'info', message: 'Missing title tag' });
  }

  return {
    valid: issues.filter((i) => i.type === 'error').length === 0,
    issues,
  };
}

/**
 * Format/minify HTML (simple formatter)
 */
export function formatHtml(html) {
  let formatted = html;

  formatted = formatted.replace(/></g, '>\n<');

  const lines = formatted.split('\n');
  let indent = 0;
  const result = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('</')) {
      indent = Math.max(0, indent - 1);
    }

    result.push('  '.repeat(indent) + trimmed);

    if (trimmed.startsWith('<') && !trimmed.startsWith('</') && !trimmed.endsWith('/>') && !trimmed.includes('</')) {
      indent += 1;
    }

    if (trimmed.includes('</') && !trimmed.startsWith('</')) {
      const openCount = (trimmed.match(/<[a-zA-Z][^>]*[^/]>/g) || []).length;
      const closeCount = (trimmed.match(/<\/[a-zA-Z][^>]*>/g) || []).length;
      if (closeCount >= openCount) {
        indent = Math.max(0, indent - 1);
      }
    }
  }

  return result.join('\n');
}
