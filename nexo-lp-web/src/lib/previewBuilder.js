/**
 * Preview utilities — simple HTML formatter/validator kept for the code editor.
 * The live preview now renders the raw generated HTML via iframe srcdoc,
 * exactly like the admin template panel, so no blob URL wrapping is needed.
 */

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
