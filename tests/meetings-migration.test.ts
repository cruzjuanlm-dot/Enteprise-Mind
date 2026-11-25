import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const root = path.resolve(import.meta.dirname, "..");
const entitiesSql = fs.readFileSync(path.join(root, "supabase/migrations/20261123120000_entities.sql"), "utf8");
const meetingsSql = fs.readFileSync(path.join(root, "supabase/migrations/20261124120000_meetings.sql"), "utf8");
const seedEntities = fs.readFileSync(path.join(root, "supabase/seed_entities.sql"), "utf8");
const seedMeetings = fs.readFileSync(path.join(root, "supabase/seed_meetings.sql"), "utf8");

test("meeting seed stores one standup, two action items, and one decision", { timeout: 120_000 }, async () => {
  const db = new PGlite();
  await db.exec(entitiesSql);
  await db.exec(meetingsSql);
  await db.exec(seedEntities);
  await db.exec(seedMeetings);

  const meeting = await db.query<{ title: string; calendar_event_id: string | null; decision_id: string }>(
    "select title, calendar_event_id, decision_id from public.meetings",
  );
  assert.equal(meeting.rows.length, 1);
  assert.equal(meeting.rows[0]?.title, "Kilnwatch release standup");
  assert.equal(meeting.rows[0]?.calendar_event_id, null);
  assert.equal(meeting.rows[0]?.decision_id, "decision.ship-curve-sheet-without-audio");

  const actions = await db.query<{ count: number }>(
    "select count(*)::int as count from public.action_items where meeting_id = 'meeting.kilnwatch-release-standup'",
  );
  const decision = await db.query<{ count: number }>(
    "select count(*)::int as count from public.decisions where id = 'decision.ship-curve-sheet-without-audio'",
  );
  assert.equal(actions.rows[0]?.count, 2);
  assert.equal(decision.rows[0]?.count, 1);

  const columns = await db.query<{ column_name: string }>(
    `select column_name from information_schema.columns
     where table_schema = 'public' and table_name = 'meeting_artifacts'`,
  );
  const names = columns.rows.map((row) => row.column_name);
  for (const banned of ["transcript", "body", "text", "words", "payload", "raw", "download_url", "content"]) {
    assert.equal(names.includes(banned), false, banned);
  }
  const artifact = await db.query<{ segment_count: number; speakers: string[] }>(
    "select segment_count, speakers from public.meeting_artifacts",
  );
  assert.equal(artifact.rows[0]?.segment_count, 4);
  assert.equal(JSON.stringify(artifact.rows).includes("Feld"), false);
  await db.close();
});

test("meeting tables are select-only when anon and authenticated exist", { timeout: 120_000 }, async () => {
  const db = new PGlite();
  await db.exec("create role anon nologin");
  await db.exec("create role authenticated nologin");
  await db.exec(entitiesSql);
  await db.exec(meetingsSql);
  const policies = await db.query<{ tablename: string; cmd: string }>(
    `select tablename, cmd from pg_policies
     where schemaname = 'public' and tablename in ('meetings', 'bots', 'meeting_artifacts', 'action_items')`,
  );
  for (const table of ["meetings", "bots", "meeting_artifacts", "action_items"]) {
    const rows = policies.rows.filter((row) => row.tablename === table);
    assert.deepEqual(rows.map((row) => row.cmd), ["SELECT"], table);
  }
  await db.close();
});
