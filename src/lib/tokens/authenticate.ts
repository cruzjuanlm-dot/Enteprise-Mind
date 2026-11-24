import { randomUUID } from "node:crypto";
import { SubscriptionInactiveError, requireActiveSubscription } from "../subscription";
import { hashToken, timingSafeEqualText, tokenPepper, TokenAuthError, TOKEN_PREFIX } from "./crypto";
import { defaultTokenRateLimiter, type RateLimiter } from "./rate-limit";
import type { TokenScope } from "./scopes";
import { toTokenMetadata, type TokenMetadata, type TokenStore } from "./store";

const DUMMY_HASH = "0".repeat(64);

export function readBearer(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/.exec(header);
  return match?.[1] ?? null;
}

export type BearerContext = {
  token: TokenMetadata;
  subscriberId: string;
  scopes: TokenScope[];
};

/**
 * Bearer middleware for subscriber API tokens.
 *
 * FLUX_BOTS_AUTH_SECRET remains the internal credential for POST /api/bots.
 * It is one shared secret, not a subscriber token, and it has no scopes.
 * A personal token (prefix flux_) is accepted on that route only when it
 * includes meetings:write. Both paths still require FLUX_SUBSCRIPTION_ACTIVE.
 * Personal tokens are also the credential for /api/mcp.
 */
export async function authenticateBearer(
  request: Request,
  options: {
    env: NodeJS.ProcessEnv;
    store: TokenStore;
    now: number;
    requiredScope?: TokenScope;
    rateLimit?: RateLimiter;
    requireSubscription?: boolean;
  },
): Promise<BearerContext> {
  const presented = readBearer(request);
  if (!presented || !presented.startsWith(TOKEN_PREFIX)) {
    throw new TokenAuthError("unauthorized", 401);
  }
  return authenticatePlaintext(presented, options);
}

export async function authenticatePlaintext(
  plaintext: string,
  options: {
    env: NodeJS.ProcessEnv;
    store: TokenStore;
    now: number;
    requiredScope?: TokenScope;
    rateLimit?: RateLimiter;
    requireSubscription?: boolean;
  },
): Promise<BearerContext> {
  const pepper = tokenPepper(options.env);
  const computed = hashToken(plaintext, pepper);
  const record = await options.store.findByHash(computed);
  const matches = timingSafeEqualText(computed, record?.tokenHash ?? DUMMY_HASH);
  if (!record || !matches) throw new TokenAuthError("unauthorized", 401);
  if (record.revokedAt) throw new TokenAuthError("token_revoked", 401);
  if (record.expiresAt && Date.parse(record.expiresAt) <= options.now) {
    throw new TokenAuthError("token_expired", 401);
  }
  const limit = (options.rateLimit ?? defaultTokenRateLimiter())(record.id, options.now);
  if (!limit.allowed) throw new TokenAuthError("rate_limited", 429);
  if (options.requiredScope && !record.scopes.includes(options.requiredScope)) {
    throw new TokenAuthError("insufficient_scope", 403);
  }
  if (options.requireSubscription !== false) {
    try {
      requireActiveSubscription(options.env);
    } catch (error) {
      if (error instanceof SubscriptionInactiveError) throw error;
      throw error;
    }
  }
  const usedAt = new Date(options.now).toISOString();
  await options.store.touchLastUsed(record.id, usedAt);
  const token = toTokenMetadata({ ...record, lastUsedAt: usedAt });
  return { token, subscriberId: record.subscriberId, scopes: token.scopes };
}

export function tokenErrorResponse(error: unknown): Response {
  if (error instanceof TokenAuthError || error instanceof SubscriptionInactiveError) {
    return Response.json({ error: error.code }, { status: error.status });
  }
  console.error(JSON.stringify({ event: "token_unhandled", name: error instanceof Error ? error.name : "error" }));
  return Response.json({ error: "internal" }, { status: 500 });
}

export function newTokenId(): string {
  return `token.${randomUUID()}`;
}
