/** @typedef {{allowed: boolean, limit: number, remaining: number, resetAt: number}} RateLimitResult */

/**
 * Small per-process fixed-window limiter. Deployments with multiple instances
 * can inject a shared limiter with the same interface.
 *
 * @param {{limit: number, windowMs: number, now?: () => number}} options
 */
export function createRateLimiter({ limit, windowMs, now = Date.now }) {
  /** @type {Map<string, {count: number, resetAt: number}>} */
  const windows = new Map();
  return {
    /** @param {string} key @returns {RateLimitResult} */
    consume(key) {
      const timestamp = now();
      let window = windows.get(key);
      if (!window || timestamp >= window.resetAt) {
        window = { count: 0, resetAt: timestamp + windowMs };
        windows.set(key, window);
      }
      window.count += 1;
      return {
        allowed: window.count <= limit,
        limit,
        remaining: Math.max(0, limit - window.count),
        resetAt: window.resetAt,
      };
    },
  };
}
