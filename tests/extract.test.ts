import assert from "node:assert/strict";
import test from "node:test";
import { extractDeterministic } from "../src/lib/extract";
import { normalizeTranscript } from "../src/lib/normalize";
import { SAMPLE_TRANSCRIPT } from "../src/lib/sample";

test("deterministic extractor keeps unknown fields unknown", () => {
  const units = extractDeterministic(SAMPLE_TRANSCRIPT);
  assert.equal(units.length, 2);

  const decision = units[0];
  assert.equal(decision.unitType, "design_decision");
  assert.equal(decision.ownerPresence, "known");
  assert.equal(decision.ownerName, "Project lead");
  assert.deepEqual(decision.dependencies, []);
  assert.equal(decision.dependenciesPresence, "known");
  assert.deepEqual(decision.systemsTouched, ["Review queue"]);
  assert.equal(decision.acceptancePresence, "known");
  assert.equal(decision.dueDate, "2026-12-15");
  assert.equal(decision.approvalRequired, true);

  const task = units[1];
  assert.equal(task.unitType, "pending_task");
  assert.equal(task.ownerPresence, "unknown");
  assert.equal(task.ownerName, null);
  assert.deepEqual(task.dependencies, ["Record an owner on every task"]);
  assert.equal(task.systemsPresence, "unknown");
  assert.equal(task.duePresence, "unknown");
  assert.equal(task.approvalRequired, false);
  assert.equal(task.approvalPresence, "known");
});

test("missing execution fields are not invented", () => {
  const [unit] = extractDeterministic("Decision: Keep the transcript\nDetails: No owner was named.");
  assert.equal(unit.ownerPresence, "unknown");
  assert.equal(unit.dependenciesPresence, "unknown");
  assert.equal(unit.systemsPresence, "unknown");
  assert.equal(unit.acceptancePresence, "unknown");
  assert.equal(unit.duePresence, "unknown");
  assert.equal(unit.approvalPresence, "unknown");
  assert.equal(unit.body, "No owner was named.");
});

test("vtt and json normalize into the same shape", () => {
  const vtt = normalizeTranscript(
    "vtt",
    "WEBVTT\n\n00:00:00.000 --> 00:00:02.000\n<v Avery>Decision: Ship the queue\n",
  );
  const json = normalizeTranscript("json", {
    turns: [{ speaker: "Avery", text: "Decision: Ship the queue" }],
  });
  assert.equal(vtt.ok && json.ok, true);
  if (vtt.ok && json.ok) {
    assert.equal(vtt.text, json.text);
    assert.deepEqual(vtt.speakers, ["Avery"]);
  }
  const units = extractDeterministic(vtt.ok ? vtt.text : "");
  assert.equal(units[0]?.title, "Ship the queue");
});

test("empty and broken transcripts are rejected", () => {
  assert.equal(normalizeTranscript("text", "   ").ok, false);
  assert.equal(normalizeTranscript("json", "{").ok, false);
  const bad = normalizeTranscript("json", "{");
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.reason, "invalid_format");
});
