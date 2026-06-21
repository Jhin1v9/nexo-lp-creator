/**
 * Preview Builder - Creates sandboxed blob URLs from HTML
 */

const DEFAULT_CSP = [
  "default-src 'self'",
  "script-src 'unsafe-inline' 'unsafe-eval' blob: https://cdn.tailwindcss.com",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data: https: blob:",
  "connect-src 'self'",
  "frame-src 'none'",
].join('; ');

const DEFAULT_STYLES = `
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', system-ui, sans-serif; }
    img { max-width: 100%; height: auto; }
  </style>
`;

const FONT_LINKS = `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
`;

const TAILWIND_CDN = `
  <script src="https://cdn.tailwindcss.com"></script>
`;

/**
 * Wrap raw HTML in a full document with CSP and styles
 */
export function buildPreviewDocument(html, options = {}) {
  const {
    csp = DEFAULT_CSP,
    title = 'Preview',
    injectStyles = true,
    injectFonts = true,
    baseUrl = '',
  } = options;

  // Guard: if the content does not contain real HTML, show a clear error
  // instead of leaking raw JSON/metadata text into the preview iframe.
  const looksLikeHtml = /<(html|!doctype|body|div|section|header|footer|main)/i.test(html || '');
  if (!looksLikeHtml) {
    const safePreview = html ? html.substring(0, 500).replace(/</g, '&lt;') : '(empty)';
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview Error</title>
  <style>
    body { font-family: Inter, system-ui, sans-serif; background: #0f172a; color: #e2e8f0; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 2rem; }
    .box { max-width: 640px; background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 2rem; }
    h1 { font-size: 1.25rem; color: #f87171; margin-bottom: 0.75rem; }
    p { color: #94a3b8; line-height: 1.6; margin-bottom: 1rem; }
    pre { background: #0f172a; padding: 1rem; border-radius: 8px; overflow-x: auto; font-size: 0.8rem; color: #cbd5e1; }
  </style>
</head>
<body>
  <div class="box">
    <h1>Preview indisponível</h1>
    <p>O conteúdo gerado não é HTML válido. Isso pode acontecer quando a IA responde com JSON de estrutura em vez do código da página. Tente regenerar ou edite o código manualmente.</p>
    <pre>${safePreview}</pre>
  </div>
</body>
</html>`;
  }

  // Extract body content if full document provided
  let bodyContent = html;
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    bodyContent = bodyMatch[1];
  }

  // Extract head content
  let headContent = '';
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  if (headMatch) {
    headContent = headMatch[1];
  }

  const doc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <title>${title}</title>
  ${TAILWIND_CDN}
  ${injectFonts ? FONT_LINKS : ''}
  ${injectStyles ? DEFAULT_STYLES : ''}
  ${headContent}
  <style>
    /* Scrollbar styling for preview */
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: #94A3B8; }
  </style>
</head>
<body>
  ${bodyContent}
</body>
</html>`;

  return doc;
}

/**
 * Create a blob URL from HTML string
 */
export function createBlobUrl(html, options = {}) {
  try {
    const doc = buildPreviewDocument(html, options);
    const blob = new Blob([doc], { type: 'text/html' });
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error('Failed to create blob URL:', error);
    return null;
  }
}

/**
 * Revoke a blob URL to free memory
 */
export function revokeBlobUrl(url) {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
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

  // Check for basic structure
  if (!html.includes('<')) {
    issues.push({ type: 'error', message: 'No HTML tags found' });
  }

  // Check for unclosed tags (basic check)
  const openTags = (html.match(/<\w+[\s>]/g) || []).length;
  const closeTags = (html.match(/<\/\w+>/g) || []).length;
  const selfClosing = (html.match(/<(br|hr|img|input|meta|link|area|base|col|embed|param|source|track|wbr)[\s>]/g) || []).length;

  if (openTags > closeTags + selfClosing) {
    issues.push({ type: 'warning', message: 'Potentially unclosed tags detected' });
  }

  // Check for common issues
  if (!html.includes('<!DOCTYPE') && !html.includes('<!doctype')) {
    issues.push({ type: 'info', message: 'Missing DOCTYPE declaration' });
  }

  if (!html.includes('<title')) {
    issues.push({ type: 'info', message: 'Missing title tag' });
  }

  return {
    valid: issues.filter(i => i.type === 'error').length === 0,
    issues,
  };
}

/**
 * Format/minify HTML (simple formatter)
 */
export function formatHtml(html) {
  let formatted = html;

  // Add newlines around tags
  formatted = formatted.replace(/></g, '>\n<');

  // Basic indentation
  const lines = formatted.split('\n');
  let indent = 0;
  const result = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Decrease indent for closing tags
    if (trimmed.startsWith('</')) {
      indent = Math.max(0, indent - 1);
    }

    result.push('  '.repeat(indent) + trimmed);

    // Increase indent for opening tags (not self-closing)
    if (trimmed.startsWith('<') && !trimmed.startsWith('</') && !trimmed.endsWith('/>') && !isSelfClosing(trimmed)) {
      indent++;
    }
  }

  return result.join('\n');
}

function isSelfClosing(tag) {
  const selfClosingTags = ['br', 'hr', 'img', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'param', 'source', 'track', 'wbr'];
  const match = tag.match(/<(\w+)/);
  return match && selfClosingTags.includes(match[1]);
}

/**
 * Escape HTML for display
 */
export function escapeHtml(html) {
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
}
