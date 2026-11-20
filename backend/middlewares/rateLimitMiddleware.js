import { AppError } from '../core/AppError.js';

/**
 * Crea un limitador de peticiones por ventana deslizante en memoria (Rate Limiting).
 * Protege endpoints de autenticación contra ataques de fuerza bruta sin dependencias externas.
 */
export function createRateLimiter({
  windowMs = 15 * 60 * 1000,
  maxRequests = 20,
  keyPrefix = 'rl',
  message = 'Demasiadas solicitudes consecutivas. Por favor intente nuevamente en unos minutos.',
  keyGenerator = null
} = {}) {
  const buckets = new Map();

  // Limpieza periódica de entradas expiradas para evitar crecimiento de memoria
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of buckets.entries()) {
      const valid = timestamps.filter((ts) => now - ts < windowMs);
      if (valid.length === 0) {
        buckets.delete(key);
      } else {
        buckets.set(key, valid);
      }
    }
  }, Math.max(windowMs, 60 * 1000));

  if (typeof cleanupTimer.unref === 'function') {
    cleanupTimer.unref();
  }

  return function rateLimitMiddleware(req, res, next) {
    const now = Date.now();
    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    const rawKey = typeof keyGenerator === 'function' ? keyGenerator(req, clientIp) : clientIp;
    const key = `${keyPrefix}:${String(rawKey).trim().toLowerCase()}`;

    const recentTimestamps = (buckets.get(key) || []).filter((ts) => now - ts < windowMs);

    if (recentTimestamps.length >= maxRequests) {
      const oldestTs = recentTimestamps[0];
      const retryAfterSec = Math.max(1, Math.ceil((oldestTs + windowMs - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      res.setHeader('X-RateLimit-Limit', String(maxRequests));
      res.setHeader('X-RateLimit-Remaining', '0');
      buckets.set(key, recentTimestamps);
      return next(new AppError(message, 429, 'RATE_LIMIT_EXCEEDED'));
    }

    recentTimestamps.push(now);
    buckets.set(key, recentTimestamps);

    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, maxRequests - recentTimestamps.length)));
    return next();
  };
}
