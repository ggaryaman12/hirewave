// Minimal in-memory fixed-window rate limiter for auth routes. Per-process only
// (fine for single-instance dev/self-host; use a shared store behind a load
// balancer). Returns true if the action is allowed.
const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}
