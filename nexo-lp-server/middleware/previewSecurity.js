const DEFAULT_ALLOWLIST = [
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
  'https://cdnjs.cloudflare.com',
  'https://image.pollinations.ai',
  'https://pollinations.ai',
];

function buildCsp() {
  const custom = process.env.PREVIEW_CSP_ALLOWLIST;
  const allowlist = custom
    ? custom.split(',').map((u) => u.trim()).filter(Boolean)
    : DEFAULT_ALLOWLIST;

  const sources = allowlist.join(' ');
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${sources}`,
    `style-src 'self' 'unsafe-inline' ${sources}`,
    `img-src 'self' data: blob: ${sources}`,
    `font-src 'self' ${sources}`,
    "connect-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "upgrade-insecure-requests",
  ].join('; ');
}

function previewSecurityHeaders(req, res, next) {
  res.setHeader('Content-Security-Policy', buildCsp());
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.removeHeader('Set-Cookie');
  next();
}

module.exports = { previewSecurityHeaders, buildCsp };
