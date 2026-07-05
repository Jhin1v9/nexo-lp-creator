const requests = new Map();
const WINDOW_MS = 60 * 1000;

function rateLimit({ max = 60, windowMs = WINDOW_MS } = {}) {
  return (req, res, next) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const record = requests.get(key) || { count: 0, resetAt: now + windowMs };

    if (now > record.resetAt) {
      record.count = 0;
      record.resetAt = now + windowMs;
    }

    record.count += 1;
    requests.set(key, record);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - record.count));

    if (record.count > max) {
      return res.status(429).json({ error: 'Too many requests' });
    }

    next();
  };
}

module.exports = { rateLimit };
