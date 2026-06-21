const crypto = require('crypto');

function requireAdmin(req, res, next) {
  const expected = process.env.ADMIN_SECRET;

  if (!expected) {
    console.error('ADMIN_SECRET is not configured');
    return res.status(500).json({ success: false, error: 'Server misconfigured' });
  }

  let token = null;

  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }

  // Server-Sent Events (and other GET requests that cannot send custom headers)
  // may authenticate via a query-string token.
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
