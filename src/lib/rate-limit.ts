/**
 * Tiny in-memory rate limiter for abuse-prone endpoints (invite generation,
 * sign-up flows).
 *
 * Why in-memory: CampusOS starts on a single Next.js instance / a handful of
 * serverless instances, and we would rather ship a zero-dependency guard than
 * require Redis on day one. It is *best effort* — a serverless platform may run
 * several isolates, each with its own counter. When the app grows, swap the
 * `buckets` map for Upstash/Redis behind the same interface.
 *
 * Usage:
 *   const limited = rateLimit(`invite:${user.id}`, { limit: 20, windowMs: 60_000 });
 *   if (!limited.ok) return NextResponse.json({ error: "..." }, { status: 429 });
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Drop expired buckets so the map can't grow without bound. */
function sweep(now: number) {
  if (buckets.size < 1000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  /** Seconds until the window resets — use it for the Retry-After header. */
  retryAfterSeconds: number;
};

export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  const remaining = Math.max(0, limit - existing.count);
  const retryAfterSeconds = Math.ceil((existing.resetAt - now) / 1000);

  return { ok: existing.count <= limit, remaining, retryAfterSeconds };
}

/** Best-effort client identity for rate-limit keys (works behind Vercel). */
export function clientKey(request: Request, prefix: string): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return `${prefix}:${ip}`;
}
