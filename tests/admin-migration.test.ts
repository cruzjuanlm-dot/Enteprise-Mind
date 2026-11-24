import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { hashToken } from "../src/lib/tokens/crypto";
import { SEEDED_TOKEN_HASHES } from "../src/lib/tokens/seed-meta";
import { ACTIVE_FIXTURE_TOKEN, FIXTURE_PEPPER, REVOKED_FIXTURE_TOKEN } from "./fixtures/hearthline-tokens";

const root = path.resolve(import.meta.dirname, "..");

test("admin migration seeds Hearthline tokens as hashes and hides the hash", { timeout: 120_000 }, async () => {
  const db = new PGlite();
  await db.exec("create role anon nologin");
  await db.exec("create role authenticated nologin");
  await db.exec(read("supabase/migrations/20261123120000_entities.sql"));
  await db.exec(read("supabase/migrations/20261124120000_meetings.sql"));
  await db.exec(read("supabase/migrations/20261125120000_admin_tokens.sql"));
  await db.exec(read("supabase/seed_entities.sql"));
  await db.exec(read("supabase/seed_meetings.sql"));
  await db.exec(read("supabase/seed_admin.sql"));

  assert.equal(hashToken(ACTIVE_FIXTURE_TOKEN, FIXTURE_PEPPER), SEEDED_TOKEN_HASHES.active);
  assert.equal(hashToken(REVOKED_FIXTURE_TOKEN, FIXTURE_PEPPER), SEEDED_TOKEN_HASHES.revoked);

  const tokens = await db.query<{ id: string; token_hash: string; revoked_at: string | null; prefix: string }>(
    "select id, token_hash, revoked_at, prefix from public.api_tokens order by id",
  );
  assert.equal(tokens.rows.length, 2);
  assert.equal(tokens.rows[0]?.id, "token.hearthline-active");
  assert.equal(tokens.rows[0]?.revoked_at, null);
  assert.equal(tokens.rows[0]?.token_hash, SEEDED_TOKEN_HASHES.active);
  assert.equal(tokens.rows[1]?.id, "token.hearthline-revoked");
  assert.ok(tokens.rows[1]?.revoked_at);
  assert.equal(tokens.rows.every((row) => row.prefix === "flux_" && !row.token_hash.startsWith("flux_")), true);
  const dumped = JSON.stringify(tokens.rows);
  assert.equal(dumped.includes(ACTIVE_FIXTURE_TOKEN), false);
  assert.equal(dumped.includes(REVOKED_FIXTURE_TOKEN), false);

  const workspace = await db.query<{ name: string }>("select name from public.workspaces");
  assert.equal(workspace.rows[0]?.name, "Hearthline Instruments");
  const admins = await db.query<{ count: number }>("select count(*)::int as count from public.admin_roles");
  assert.equal(admins.rows[0]?.count, 1);

  const hashPrivilege = await db.query<{ ok: boolean }>(
    "select has_column_privilege('authenticated', 'public.api_tokens', 'token_hash', 'SELECT') as ok",
  );
  const last4Privilege = await db.query<{ ok: boolean }>(
    "select has_column_privilege('authenticated', 'public.api_tokens', 'last4', 'SELECT') as ok",
  );
  const anonPrivilege = await db.query<{ ok: boolean }>(
    "select has_column_privilege('anon', 'public.api_tokens', 'last4', 'SELECT') as ok",
  );
  assert.equal(hashPrivilege.rows[0]?.ok, false);
  assert.equal(last4Privilege.rows[0]?.ok, true);
  assert.equal(anonPrivilege.rows[0]?.ok, false);

  await asRole(db, "subscriber.hearthline-admin", async () => {
    const own = await db.query<{ id: string }>("select id from public.api_tokens order by id");
    assert.deepEqual(
      own.rows.map((row) => row.id),
      ["token.hearthline-active", "token.hearthline-revoked"],
    );
    await assert.rejects(() => db.query("select token_hash from public.api_tokens"));
  });
  await asRole(db, "subscriber.hearthline-editor", async () => {
    const own = await db.query<{ count: number }>("select count(*)::int as count from public.api_tokens");
    assert.equal(own.rows[0]?.count, 0);
  });
  await db.exec("begin");
  await db.exec("set local role anon");
  await assert.rejects(() => db.query("select id from public.api_tokens"));
  await db.exec("rollback");
  await db.exec("begin");
  await db.exec("set local role authenticated");
  await db.exec("select set_config('request.jwt.claim.sub', 'subscriber.hearthline-admin', true)");
  await assert.rejects(() => db.query("select id from public.audit_log"));
  await db.exec("rollback");
  await db.close();
});

async function asRole(db: PGlite, subscriberId: string, run: () => Promise<void>) {
  await db.exec("begin");
  await db.exec(`select set_config('request.jwt.claim.sub', '${subscriberId}', true)`);
  await db.exec("set local role authenticated");
  try {
    await run();
  } finally {
    await db.exec("rollback");
  }
}

function read(relative: string): string {
  return fs.readFileSync(path.join(root, relative), "utf8");
}
