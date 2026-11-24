export type RateLimitDecision = {
  allowed: boolean;
  limit: number;
  remaining: number;
};

export type RateLimiter = (tokenId: string, now: number) => RateLimitDecision;

export function createRateLimiter(limit: number, windowMs: number): RateLimiter {
  const hits = new Map<string, number[]>();
  return (tokenId, now) => {
    const recent = (hits.get(tokenId) ?? []).filter((at) => now - at < windowMs);
    if (recent.length >= limit) {
      hits.set(tokenId, recent);
      return { allowed: false, limit, remaining: 0 };
    }
    recent.push(now);
    hits.set(tokenId, recent);
    return { allowed: true, limit, remaining: limit - recent.length };
  };
}

export const DEFAULT_TOKEN_LIMIT = 60;
export const DEFAULT_TOKEN_WINDOW_MS = 60_000;

const shared = createRateLimiter(DEFAULT_TOKEN_LIMIT, DEFAULT_TOKEN_WINDOW_MS);

export function defaultTokenRateLimiter(): RateLimiter {
  return shared;
}
