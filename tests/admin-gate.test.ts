import assert from "node:assert/strict";
import test from "node:test";
import { handleAdminRevoke, handleAdminSession } from "../src/lib/admin/http";
import { adminSessionValue } from "../src/lib/admin/gate";
import { buildAdminView } from "../src/lib/admin/view";
import { MemoryTokenStore } from "../src/lib/tokens/memory-store";
import { ACTIVE_TOKEN_ID } from "../src/lib/tokens/seed-meta";

test("admin gate fails closed without the secret", async () => {
  let reads = 0;
  const store = new MemoryTokenStore();
  const original = store.listAllMetadata.bind(store);
  store.listAllMetadata = async () => {
    reads += 1;
    return original();
  };
  const view = await buildAdminView({
    env: { NODE_ENV: "test" },
    authorizationHeader: null,
    adminCookie: null,
    store,
    now: () => Date.parse("2026-11-24T12:00:00.000Z"),
  });
  assert.equal(view.kind, "unavailable");
  if (view.kind === "unavailable") assert.equal(view.code, "admin_unconfigured");
  assert.equal(reads, 0);

  const response = await handleAdminSession(json({ secret: "anything" }), {
    env: { NODE_ENV: "test" },
    store,
    now: () => Date.parse("2026-11-24T12:00:00.000Z"),
  });
  assert.equal(response.status, 403);
  assert.equal(((await response.json()) as { error: string }).error, "admin_unconfigured");
  assert.equal(response.headers.get("set-cookie"), null);
});

test("admin gate requires the secret and an admin role", async () => {
  const now = () => Date.parse("2026-11-24T12:00:00.000Z");
  const env = { NODE_ENV: "test" as const, FLUX_ADMIN_SECRET: "admin-test-secret", FLUX_SUBSCRIPTION_ACTIVE: "true" };
  const empty = new MemoryTokenStore({ seed: false });
  const missingRole = await handleAdminSession(json({ secret: "admin-test-secret" }), { env, store: empty, now });
  assert.equal(missingRole.status, 403);

  const store = new MemoryTokenStore();
  const wrong = await handleAdminSession(json({ secret: "wrong-secret" }), { env, store, now });
  assert.equal(wrong.status, 403);
  assert.equal(((await wrong.json()) as { error: string }).error, "admin_forbidden");

  const signed = await handleAdminSession(json({ secret: "admin-test-secret" }), { env, store, now });
  assert.equal(signed.status, 200);
  const cookie = signed.headers.get("set-cookie") ?? "";
  assert.match(cookie, new RegExp(`flux_admin=${adminSessionValue("admin-test-secret")}`));
  assert.equal(cookie.includes("admin-test-secret"), false);

  const closed = await buildAdminView({
    env,
    authorizationHeader: null,
    adminCookie: null,
    store,
    now,
  });
  assert.equal(closed.kind, "sign-in");

  const open = await buildAdminView({
    env,
    authorizationHeader: "Bearer admin-test-secret",
    adminCookie: null,
    store,
    now,
  });
  assert.equal(open.kind, "ready");
  if (open.kind === "ready") {
    assert.equal(open.workspaces[0]?.name, "Hearthline Instruments");
    assert.equal(open.subscription.active, true);
    assert.equal(open.subscription.stripeConnected, false);
    assert.ok(open.bots.some((bot) => bot.id === "bot.kilnwatch-seed"));
    assert.equal(JSON.stringify(open.tokens).includes("tokenHash"), false);
    const active = open.tokens.find((token) => token.id === ACTIVE_TOKEN_ID);
    assert.equal(active?.prefix, "flux_");
    assert.equal(active?.last4, "LHpU");
    assert.equal(active?.revokedAt, null);
  }

  const revoked = await handleAdminRevoke(json({ id: ACTIVE_TOKEN_ID }), {
    env,
    store,
    now,
    authorizationHeader: null,
    adminCookie: null,
  });
  assert.equal(revoked.status, 403);

  const form = await handleAdminSession(
    new Request("http://localhost:3456/api/admin/session", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-forwarded-host": "127.0.0.1:3456",
      },
      body: new URLSearchParams({ secret: "admin-test-secret" }),
    }),
    { env, store, now },
  );
  assert.equal(form.status, 303);
  assert.equal(form.headers.get("location"), "http://127.0.0.1:3456/admin");
  assert.match(form.headers.get("set-cookie") ?? "", /flux_admin=/);
  assert.equal((form.headers.get("set-cookie") ?? "").includes("admin-test-secret"), false);
});

function json(body: unknown): Request {
  return new Request("https://enterprise-mind.local/api/admin/session", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
}
