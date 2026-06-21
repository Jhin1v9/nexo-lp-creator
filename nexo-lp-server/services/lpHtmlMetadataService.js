/**
 * NEXO Landing Page Creator v3.0 - HTML Metadata Service
 *
 * Ensures generated landing pages always have consistent, SEO-friendly
 * <title> and Open Graph tags derived from the structured brief.
 */

function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildMetaTags(title, description) {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const tags = [];
  if (safeTitle) {
    tags.push(`<title>${safeTitle}</title>`);
    tags.push(`<meta property="og:title" content="${safeTitle}">`);
    tags.push(`<meta name="twitter:title" content="${safeTitle}">`);
  }
  if (safeDescription) {
    tags.push(`<meta name="description" content="${safeDescription}">`);
    tags.push(`<meta property="og:description" content="${safeDescription}">`);
    tags.push(`<meta name="twitter:description" content="${safeDescription}">`);
  }
  if (safeTitle) {
    tags.push('<meta property="og:type" content="website">');
    tags.push('<meta name="twitter:card" content="summary_large_image">');
  }
  return tags.join('\n');
}

/**
 * Inject or replace <title> and OG/Twitter meta tags in the HTML head.
 * Keeps existing tags intact if the brief does not provide values.
 * @param {string} html
 * @param {object} brief
 * @param {string} brief.title
 * @param {string} brief.description
 * @returns {string}
 */
function injectMetadata(html, brief = {}) {
  if (!html || typeof html !== 'string') return html;

  const title = (brief.title || '').trim();
  const description = (brief.description || '').trim().slice(0, 160);
  if (!title && !description) return html;

  let result = html;

  // Replace existing <title> if a title is provided.
  if (title) {
    result = result.replace(/<title>[^]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  }

  // Replace existing meta description if description is provided.
  if (description) {
    result = result.replace(
      /<meta\s+name=["']description["']\s+content=["'][^"']*["']\s*\/?>/i,
      `<meta name="description" content="${escapeHtml(description)}">`
    );
    result = result.replace(
      /<meta\s+property=["']og:description["']\s+content=["'][^"']*["']\s*\/?>/i,
      `<meta property="og:description" content="${escapeHtml(description)}">`
    );
    result = result.replace(
      /<meta\s+name=["']twitter:description["']\s+content=["'][^"']*["']\s*\/?>/i,
      `<meta name="twitter:description" content="${escapeHtml(description)}">`
    );
  }

  // Replace existing og:title/twitter:title if title is provided.
  if (title) {
    result = result.replace(
      /<meta\s+property=["']og:title["']\s+content=["'][^"']*["']\s*\/?>/i,
      `<meta property="og:title" content="${escapeHtml(title)}">`
    );
    result = result.replace(
      /<meta\s+name=["']twitter:title["']\s+content=["'][^"']*["']\s*\/?>/i,
      `<meta name="twitter:title" content="${escapeHtml(title)}">`
    );
  }

  // Determine which required tags are still missing.
  const hasTitleTag = /<title>/i.test(result);
  const hasOgTitle = /<meta\s+property=["']og:title["']/i.test(result);
  const hasMetaDesc = /<meta\s+name=["']description["']/i.test(result);
  const hasOgDesc = /<meta\s+property=["']og:description["']/i.test(result);

  const missingTitle = title && (!hasTitleTag || !hasOgTitle);
  const missingDesc = description && (!hasMetaDesc || !hasOgDesc);

  if (missingTitle || missingDesc) {
    const metaBlock = buildMetaTags(title, description);
    if (/<\/head>/i.test(result)) {
      result = result.replace(/<\/head>/i, `${metaBlock}\n</head>`);
    } else if (/<html[^>]*>/i.test(result)) {
      result = result.replace(/(<html[^>]*>)/i, `$1<head>${metaBlock}</head>`);
    }
  }

  return result;
}

module.exports = { injectMetadata, escapeHtml, buildMetaTags };
