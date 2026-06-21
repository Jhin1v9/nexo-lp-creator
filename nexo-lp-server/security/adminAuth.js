const crypto = require('crypto');

function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const expected = process.env.ADMIN_SECRET;

  if (!expected) {
    console.error('ADMIN_SECRET is not configured');
    return res.status(500).json({ success: false, error: 'Server misconfigured' });
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
