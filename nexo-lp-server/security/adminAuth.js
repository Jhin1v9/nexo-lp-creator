const crypto = require('crypto');

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

function isLoopback(ip) {
  if (!ip || ip === 'unknown') return false;
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip.startsWith('127.');
}

function isIpAllowed(req) {
  const allowed = process.env.ADMIN_ALLOWED_IPS;
  if (!allowed) return true;
  const clientIp = getClientIp(req);
  const allowedList = allowed.split(',').map((ip) => ip.trim());
  return allowedList.includes(clientIp) || (allowedList.includes('127.0.0.1') && isLoopback(clientIp));
}

function requireAdmin(req, res, next) {
  const expected = process.env.ADMIN_SECRET;

  if (!expected) {
    console.error('[adminAuth] ADMIN_SECRET is not configured');
    return res.status(500).json({ success: false, error: 'Server misconfigured' });
  }

  if (!isIpAllowed(req)) {
    console.warn(`[adminAuth] IP not allowed: ${getClientIp(req)}`);
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }

  let token = null;

  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }

  if (!token && req.method === 'GET' && req.query && req.query.adminToken) {
    token = req.query.adminToken;
  }

  if (!token || token.length !== expected.length) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(expected);

  if (!crypto.timingSafeEqual(tokenBuf, expectedBuf)) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  req.userId = req.get('X-Admin-User-Id') || 'admin';
  next();
}

module.exports = requireAdmin;
module.exports.getClientIp = getClientIp;
