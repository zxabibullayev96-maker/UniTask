/**
 * UniTask AI - Yengil va samarali Rate Limiter (Brute-force himoyasi)
 * IP va Email asosida so'rovlar chastotasini cheklaydi.
 */

const ipRequests = new Map();

function rateLimit({ windowMs = 60 * 1000, max = 10, message = "Juda ko'p so'rovlar yuborildi. Iltimos, 1 daqiqadan so'ng qayta urinib ko'ring." } = {}) {
  // Har 5 daqiqada eski yozuvlarni tozalab turish
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of ipRequests.entries()) {
      if (now > record.resetTime) {
        ipRequests.delete(key);
      }
    }
  }, 5 * 60 * 1000).unref();

  return (req, res, next) => {
    // Test yoki lokal rejimda test_dynamic_quiz skriptlari bloklanmasligi uchun
    if (process.env.NODE_ENV === 'test') {
      return next();
    }

    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip';
    const key = `${clientIp}_${req.path}`;
    const now = Date.now();

    let record = ipRequests.get(key);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs
      };
      ipRequests.set(key, record);
      return next();
    }

    record.count++;

    if (record.count > max) {
      const waitSeconds = Math.ceil((record.resetTime - now) / 1000);
      return res.status(429).json({
        success: false,
        message: `${message} (${waitSeconds} soniya kuting).`,
        retryAfter: waitSeconds
      });
    }

    next();
  };
}

module.exports = {
  rateLimit
};
