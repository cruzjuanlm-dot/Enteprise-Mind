import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { ENTITY_TABLE, ENTITY_TYPES } from "../src/lib/ontology";

const root = path.resolve(import.meta.dirname, "..");
const entitiesSql = fs.readFileSync(
  path.join(root, "supabase/migrations/20261123120000_entities.sql"),
  "utf8",
);
const meetingsSql = fs.readFileSync(
  path.join(root, "supabase/migrations/20261124120000_meetings.sql"),
  "utf8",
);
const seedSql = fs.readFileSync(path.join(root, "supabase/seed_entities.sql"), "utf8");
const coreSql = fs.readFileSync(path.join(root, "supabase/migrations/20261108120000_core.sql"), "utf8");

async function coreDatabase(): Promise<PGlite> {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`
    create schema if not exists auth;
    create table if not exists auth.users (id uuid primary key);
    create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
  `);
  await db.exec("create role anon nologin");
  await db.exec("create role authenticated nologin");
  return db;
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

test("entities migration and seed apply on a fresh local database", { timeout: 120_000 }, async () => {
  const db = new PGlite();
  await db.exec(entitiesSql);
  await db.exec(meetingsSql);
  await db.exec(seedSql);

  const tables = await db.query<{ relname: string; relrowsecurity: boolean }>(
    `select c.relname, c.relrowsecurity
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'`,
  );
  const byName = new Map(tables.rows.map((row) => [row.relname, row.relrowsecurity]));
  for (const type of ENTITY_TYPES) {
    assert.equal(byName.get(ENTITY_TABLE[type]), true, ENTITY_TABLE[type]);
  }
  for (const name of ["entity_relationships", "unit_refs", "unit_ref_entities"]) {
    assert.equal(byName.get(name), true, name);
  }

  const systems = await db.query<{ count: number }>("select count(*)::int as count from public.systems");
  const units = await db.query<{ count: number; pinned: number }>(
    "select count(*)::int as count, count(commit_sha)::int as pinned from public.unit_refs",
  );
  const transcriptTables = await db.query<{ count: number }>(
    `select count(*)::int as count
     from pg_tables
     where schemaname = 'public' and tablename = 'transcripts'`,
  );
  assert.equal(systems.rows[0]?.count, 3);
  assert.equal(units.rows[0]?.count, 5);
  assert.equal(units.rows[0]?.pinned, 0);
  assert.equal(transcriptTables.rows[0]?.count, 0);
  await db.close();
});

test("catalog read policies are created when anon and authenticated exist", { timeout: 120_000 }, async () => {
  const db = await coreDatabase();
  await db.exec(entitiesSql);
  const policies = await db.query<{ count: number }>(
    `select count(*)::int as count from pg_policies where schemaname = 'public' and policyname = 'systems_read'`,
  );
  assert.equal(policies.rows[0]?.count, 1);
  await db.close();
});

test("core.sql does not apply without the Supabase auth schema", { timeout: 120_000 }, async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(coreSql);
    assert.fail("core.sql applied without Supabase auth objects");
  } catch (error) {
    assert.match(errorText(error), /auth/);
  }
  await db.close();
});

test("core, entities, meetings, and admin tokens apply in timestamp order", { timeout: 120_000 }, async () => {
  const db = await coreDatabase();
  const adminSql = fs.readFileSync(path.join(root, "supabase/migrations/20261125120000_admin_tokens.sql"), "utf8");
  const seedPilot = fs.readFileSync(path.join(root, "supabase/seed.sql"), "utf8");
  const seedMeetings = fs.readFileSync(path.join(root, "supabase/seed_meetings.sql"), "utf8");
  const seedAdmin = fs.readFileSync(path.join(root, "supabase/seed_admin.sql"), "utf8");
  await db.exec(coreSql);
  await db.exec(entitiesSql);
  await db.exec(meetingsSql);
  await db.exec(adminSql);
  await db.exec(seedPilot);
  await db.exec(seedSql);
  await db.exec(seedMeetings);
  await db.exec(seedAdmin);

  const pilot = await db.query<{ name: string }>(
    "select name from public.projects where id = '44444444-4444-4444-8444-444444444444'",
  );
  const catalog = await db.query<{ name: string }>(
    "select name from public.entity_projects where id = 'project.kilnwatch'",
  );
  const units = await db.query<{ count: number }>("select count(*)::int as count from public.unit_refs");
  const transcripts = await db.query<{ count: number }>(
    "select count(*)::int as count from information_schema.tables where table_schema = 'public' and table_name = 'transcripts'",
  );
  assert.equal(pilot.rows[0]?.name, "Sensor firmware review");
  assert.equal(catalog.rows[0]?.name, "Kilnwatch teaching release");
  assert.equal(units.rows[0]?.count, 5);
  assert.equal(transcripts.rows[0]?.count, 1);
  await db.close();
});
