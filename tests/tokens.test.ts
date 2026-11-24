import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { handleCreateBot } from "../src/lib/recall/create-bot";
import type { RecallDeps } from "../src/lib/recall/deps";
import { MemoryRecallStore } from "../src/lib/recall/store";
import { authenticatePlaintext } from "../src/lib/tokens/authenticate";
import { hashToken, timingSafeEqualText, tokenLast4, TOKEN_PREFIX, TokenAuthError, verifyTokenHash } from "../src/lib/tokens/crypto";
import { handleCreateToken, handleListTokens, handleRevokeToken } from "../src/lib/tokens/handlers";
import { MemoryTokenStore, seededSubscribers } from "../src/lib/tokens/memory-store";
import { createRateLimiter } from "../src/lib/tokens/rate-limit";
import { SEEDED_TOKEN_HASHES, SEEDED_TOKEN_LAST4 } from "../src/lib/tokens/seed-meta";
import { ACTIVE_FIXTURE_TOKEN, FIXTURE_PEPPER, REVOKED_FIXTURE_TOKEN } from "./fixtures/hearthline-tokens";

const root = path.resolve(import.meta.dirname, "..");
const NOW = Date.parse("2026-11-24T12:00:00.000Z");

test("creating a token shows the plaintext once and stores only the hash", async () => {
  const store = new MemoryTokenStore();
  const deps = tokenDeps(store);
  const { result, logs } = await capture(async () => {
    const response = await handleCreateToken(jsonRequest({ label: "Bench reader", scopes: ["units:read", "entities:read"] }), deps);
    assert.equal(response.status, 200);
    const body = (await response.json()) as { token: string; tokenMetadata: { prefix: string; last4: string; tokenHash?: string } };
    assert.match(body.token, /^flux_[A-Za-z0-9_-]{43}$/);
    assert.equal(Buffer.from(body.token.slice(TOKEN_PREFIX.length), "base64url").length, 32);
    assert.equal(body.tokenMetadata.prefix, TOKEN_PREFIX);
    assert.equal(body.tokenMetadata.last4, tokenLast4(body.token));
    assert.equal(body.tokenMetadata.tokenHash, undefined);
    const listed = await handleListTokens(deps);
    const listBody = (await listed.json()) as { tokens: Array<{ last4: string; tokenHash?: string }> };
    assert.equal(JSON.stringify(listBody).includes(body.token), false);
    assert.equal(listBody.tokens.some((token) => token.tokenHash), false);
    const stored = await store.findByHash(hashToken(body.token, FIXTURE_PEPPER));
    assert.equal(stored?.tokenHash, hashToken(body.token, FIXTURE_PEPPER));
    assert.equal(JSON.stringify(stored).includes(body.token), false);
    const audit = await store.listAudit();
    assert.equal(JSON.stringify(audit).includes(body.token), false);
    assert.ok(audit.some((entry) => entry.action === "token.create" && entry.detail.last4 === body.tokenMetadata.last4));
    return body.token;
  });
  assert.equal(logs.join("\n").includes(result), false);
});

test("revoked, expired, and wrong-scope tokens are rejected", async () => {
  const store = new MemoryTokenStore({ seed: false });
  const subscriber = seededSubscribers()[0];
  if (!subscriber) throw new Error("missing subscriber");
  const deps = tokenDeps(store, subscriber);
  const active = await create(deps, ["units:read"]);
  const expiredResponse = await handleCreateToken(
    jsonRequest({ scopes: ["meetings:write"], expiresAt: "2020-01-01T00:00:00.000Z" }),
    deps,
  );
  const expired = ((await expiredResponse.json()) as { token: string }).token;
  await handleRevokeToken(jsonRequest({ id: (await store.findByHash(hashToken(active, FIXTURE_PEPPER)))?.id }), deps);

  await expectAuth(active, store, "units:read", "token_revoked", 401);
  await expectAuth(expired, store, "meetings:write", "token_expired", 401);
  const fresh = await create(deps, ["units:read"]);
  await expectAuth(fresh, store, "meetings:write", "insufficient_scope", 403);
  await expectAuth("flux_not-a-real-token", store, "units:read", "unauthorized", 401);
});

test("token verification compares hashes in constant time", () => {
  assert.equal(timingSafeEqualText("same-value", "same-value"), true);
  assert.equal(timingSafeEqualText("same-value", "same-valuz"), false);
  assert.equal(timingSafeEqualText("same-value", "short"), false);
  const hash = hashToken(ACTIVE_FIXTURE_TOKEN, FIXTURE_PEPPER);
  const flipped = `${hash.slice(0, -1)}${hash.endsWith("a") ? "b" : "a"}`;
  assert.equal(verifyTokenHash(ACTIVE_FIXTURE_TOKEN, hash, FIXTURE_PEPPER), true);
  assert.equal(verifyTokenHash(ACTIVE_FIXTURE_TOKEN, flipped, FIXTURE_PEPPER), false);
  assert.equal(hash, SEEDED_TOKEN_HASHES.active);
  assert.equal(tokenLast4(ACTIVE_FIXTURE_TOKEN), SEEDED_TOKEN_LAST4.active);
  assert.equal(hashToken(REVOKED_FIXTURE_TOKEN, FIXTURE_PEPPER), SEEDED_TOKEN_HASHES.revoked);
});

test("a flux token can send a bot only with meetings:write", async () => {
  const store = new MemoryTokenStore({ seed: false });
  const subscriber = seededSubscribers()[0];
  if (!subscriber) throw new Error("missing subscriber");
  const deps = tokenDeps(store, subscriber);
  const reader = await create(deps, ["units:read"]);
  const sender = await create(deps, ["meetings:write"]);
  const calls: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    calls.push(String(input));
    return Response.json({ id: "recall-bot-from-token" });
  };
  const denied = await handleCreateBot(botRequest(reader), recallDeps(fetchImpl, store));
  assert.equal(denied.status, 403);
  assert.deepEqual(calls, []);
  const created = await handleCreateBot(botRequest(sender), recallDeps(fetchImpl, store));
  assert.equal(created.status, 200);
  assert.deepEqual(calls, ["https://us-east-1.recall.ai/api/v1/bot/"]);
  const used = await store.findByHash(hashToken(sender, FIXTURE_PEPPER));
  assert.equal(used?.lastUsedAt, new Date(NOW).toISOString());
});

test("the per-token rate limit stub rejects the next call", async () => {
  const store = new MemoryTokenStore({ seed: false });
  const subscriber = seededSubscribers()[0];
  if (!subscriber) throw new Error("missing subscriber");
  const token = await create(tokenDeps(store, subscriber), ["entities:read"]);
  const limiter = createRateLimiter(1, 60_000);
  await authenticatePlaintext(token, {
    env: pepperEnv(),
    store,
    now: NOW,
    requiredScope: "entities:read",
    rateLimit: limiter,
  });
  await assert.rejects(
    () =>
      authenticatePlaintext(token, {
        env: pepperEnv(),
        store,
        now: NOW + 1,
        requiredScope: "entities:read",
        rateLimit: limiter,
      }),
    (error: unknown) => error instanceof TokenAuthError && error.status === 429 && error.code === "rate_limited",
  );
});

test("fixture plaintext tokens are not stored in source or SQL", () => {
  for (const relative of walk(path.join(root, "src")).concat(walk(path.join(root, "supabase")))) {
    const text = fs.readFileSync(relative, "utf8");
    assert.equal(text.includes(ACTIVE_FIXTURE_TOKEN), false, relative);
    assert.equal(text.includes(REVOKED_FIXTURE_TOKEN), false, relative);
  }
});

async function create(deps: ReturnType<typeof tokenDeps>, scopes: string[]): Promise<string> {
  const response = await handleCreateToken(jsonRequest({ scopes }), deps);
  assert.equal(response.status, 200);
  return ((await response.json()) as { token: string }).token;
}

async function expectAuth(token: string, store: MemoryTokenStore, scope: "units:read" | "meetings:write" | "entities:read", code: string, status: number) {
  await assert.rejects(
    () =>
      authenticatePlaintext(token, {
        env: pepperEnv(),
        store,
        now: NOW,
        requiredScope: scope,
        rateLimit: () => ({ allowed: true, limit: 60, remaining: 59 }),
      }),
    (error: unknown) => error instanceof TokenAuthError && error.code === code && error.status === status,
  );
}

function tokenDeps(store: MemoryTokenStore, subscriber = seededSubscribers()[0]) {
  if (!subscriber) throw new Error("missing subscriber");
  return {
    env: pepperEnv(),
    store,
    now: () => NOW,
    subscriber,
  };
}

function pepperEnv(): NodeJS.ProcessEnv {
  return {
    FLUX_TOKEN_PEPPER: FIXTURE_PEPPER,
    FLUX_SUBSCRIPTION_ACTIVE: "true",
    RECALL_API_KEY: "recall-test-key",
    RECALL_REGION: "us-east-1",
  };
}

function jsonRequest(body: unknown): Request {
  return new Request("https://enterprise-mind.local/api/tokens", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
}

function botRequest(token: string): Request {
  return new Request("https://enterprise-mind.local/api/bots", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ meetingUrl: "https://meet.example.test/hearthline", title: "Kilnwatch release standup" }),
  });
}

function recallDeps(fetchImpl: typeof fetch, store: MemoryTokenStore): RecallDeps {
  const recall = new MemoryRecallStore();
  return {
    env: pepperEnv(),
    fetch: fetchImpl,
    sleep: async () => undefined,
    now: () => NOW,
    store: recall,
    root,
    schedule() {
      return undefined;
    },
    tokenStore: store,
  };
}

async function capture<T>(fn: () => Promise<T>): Promise<{ result: T; logs: string[] }> {
  const logs: string[] = [];
  const methods = ["log", "info", "warn", "error", "debug"] as const;
  const original = new Map<(typeof methods)[number], typeof console.log>();
  for (const method of methods) {
    original.set(method, console[method]);
    console[method] = (...args: unknown[]) => {
      logs.push(args.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).join(" "));
    };
  }
  try {
    return { result: await fn(), logs };
  } finally {
    for (const method of methods) {
      const restore = original.get(method);
      if (restore) console[method] = restore;
    }
  }
}

function walk(directory: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}
