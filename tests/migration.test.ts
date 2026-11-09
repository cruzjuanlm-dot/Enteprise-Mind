import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(new URL("../supabase/migrations/20261108120000_core.sql", import.meta.url), "utf8");

const tables = [
  "tenants",
  "tenant_memberships",
  "departments",
  "projects",
  "project_memberships",
  "transcripts",
  "transcript_speakers",
  "transcript_related_projects",
  "jobs",
  "job_events",
  "knowledge_units",
  "review_events",
];

test("core migration enables row level security on every core table", () => {
  for (const table of tables) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security;`));
  }
  assert.match(sql, /create policy transcripts_select/);
  assert.match(sql, /create policy knowledge_units_select/);
  assert.match(sql, /create policy knowledge_units_update/);
  assert.match(sql, /revoke all on all tables in schema public from anon, authenticated;/);
  assert.match(sql, /grant execute on function public\.review_unit\(uuid, text\) to authenticated;/);
  assert.doesNotMatch(sql, /service_role_key|eyJ/);
});
