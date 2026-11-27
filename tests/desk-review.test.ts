import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { addCompilation, catalogTypeFor } from "../src/lib/desk/compile";
import { searchUnits, visibleUnits } from "../src/lib/desk/read";
import { approveProposal, promoteUnit, rejectProposal, saveProposal } from "../src/lib/desk/review";
import { KILNWATCH_SAMPLE } from "../src/lib/desk/sample";
import { compileTranscript, resetDesk } from "../src/lib/desk/store";
import { emptyDesk } from "../src/lib/desk/types";
import { loadSeedEntities } from "../src/lib/ontology";
import { collectUnits } from "../src/lib/unit-index";

const root = path.resolve(import.meta.dirname, "..");
const now = "2026-11-26T12:00:00.000Z";

function entityIds(): Set<string> {
  return new Set(loadSeedEntities(root).map((entity) => entity.id));
}

function gitIds(): string[] {
  return collectUnits(root).map((unit) => unit.id);
}

test("catalog types follow the labeled block", () => {
  assert.equal(catalogTypeFor("design_decision"), "DEC");
  assert.equal(catalogTypeFor("pending_task"), "REQ");
  assert.equal(catalogTypeFor("architecture"), "ARC");
  assert.equal(catalogTypeFor("open_question"), "OQ");
  assert.equal(catalogTypeFor("risk"), "OQ");
  assert.equal(catalogTypeFor("glossary_term"), "BR");
});

test("compile, edit, approve, reject, and promote a Kilnwatch transcript", () => {
  const compiled = addCompilation(emptyDesk(), KILNWATCH_SAMPLE, now);
  assert.equal(compiled.ok, true);
  assert.equal(compiled.reason, null);
  assert.equal(compiled.proposals.length, 3);
  assert.equal(compiled.proposals[0]?.type, "DEC");
  assert.equal(compiled.proposals[1]?.type, "REQ");
  assert.equal(compiled.proposals[2]?.type, "OQ");
  assert.equal(JSON.stringify(compiled.state).includes("The standup does not leave"), true);
  assert.equal(Object.hasOwn(compiled.state, "transcript"), false);

  const decision = compiled.proposals[0];
  const task = compiled.proposals[1];
  assert.ok(decision && task);

  const edited = saveProposal(compiled.state, decision.id, {
    title: "Recordings stay out of the teaching release",
    scope: "project",
  });
  assert.equal(edited.ok, true);
  if (!edited.ok) return;

  const approved = approveProposal(edited.state, decision.id, {}, gitIds(), entityIds(), now);
  assert.equal(approved.ok, true);
  if (!approved.ok) return;
  assert.match(approved.value.id, /^kilnwatch-c[a-f0-9]{8}-DEC-001$/);
  assert.equal(approved.value.scope, "project");
  assert.equal(approved.value.status, "accepted");
  assert.ok(approved.value.entities.includes("project.kilnwatch"));
  assert.ok(approved.value.entities.includes("system.kiln-ledger"));
  assert.ok(approved.value.entities.includes("person-role.catalog-editor"));
  assert.equal(approved.value.path, `projects/kilnwatch/units/${approved.value.id}.md`);

  const rejected = rejectProposal(approved.state, task.id);
  assert.equal(rejected.ok, true);
  if (!rejected.ok) return;
  assert.equal(rejected.value.status, "rejected");

  const promoted = promoteUnit(rejected.state, approved.value.id, new Set(gitIds()), "govern");
  assert.equal(promoted.ok, true);
  if (!promoted.ok) return;
  assert.equal(promoted.value.scope, "company");
  assert.equal(promoted.value.domain, "govern");

  const visible = visibleUnits(root, promoted.state);
  const accepted = visible.find((unit) => unit.id === approved.value.id);
  assert.ok(accepted);
  assert.equal(accepted?.scope, "company");
  assert.equal(accepted?.origin, "session");
  assert.equal(visible.some((unit) => unit.title.startsWith("Publish the bench checklist")), false);
  assert.ok(visible.some((unit) => unit.id === "kilnwatch-seed-DEC-001"));

  const names = new Map(loadSeedEntities(root).map((entity) => [entity.id, entity.name]));
  const found = searchUnits(visible, "recordings stay out of the teaching release", names);
  assert.equal(found.length, 1);
  assert.equal(found[0]?.id, approved.value.id);
});

test("unlabeled text is discarded and a denied name is not stored", () => {
  const marker = "unlabeled-marker-8841";
  const loose = addCompilation(emptyDesk(), `The bench was quiet.\n${marker} was not a labeled claim.`, now);
  assert.equal(loose.ok, true);
  assert.equal(loose.reason, "unlabeled");
  assert.equal(loose.proposals.length, 0);
  assert.equal(loose.state.compilations.length, 1);
  assert.equal(JSON.stringify(loose.state).includes(marker), false);

  const denied = addCompilation(emptyDesk(), "Decision: Feld Entertainment ships a kiln\nDetails: no.", now);
  assert.equal(denied.ok, false);
  assert.equal(denied.reason, "denied");
  assert.equal(denied.state.proposals.length, 0);
  assert.equal(denied.state.compilations.length, 0);

  const empty = addCompilation(emptyDesk(), "   ", now);
  assert.equal(empty.reason, "empty");
});

test("a repeated transcript does not propose a second set", () => {
  const first = addCompilation(emptyDesk(), KILNWATCH_SAMPLE, now);
  const second = addCompilation(first.state, KILNWATCH_SAMPLE, now);
  assert.equal(second.reason, "duplicate");
  assert.equal(second.state.proposals.length, first.state.proposals.length);
});

test("company scope on a git unit is a tag and the path stays put", () => {
  const id = "kilnwatch-seed-DEC-001";
  const promoted = promoteUnit(emptyDesk(), id, new Set(gitIds()), "govern");
  assert.equal(promoted.ok, true);
  const visible = visibleUnits(root, promoted.state);
  const unit = visible.find((item) => item.id === id);
  assert.equal(unit?.scope, "company");
  assert.equal(unit?.domain, "govern");
  assert.equal(unit?.path, "projects/kilnwatch/units/kilnwatch-seed-DEC-001.md");
  assert.equal(unit?.origin, "git");
});

test("the session store keeps proposals and drops the transcript", () => {
  resetDesk();
  const marker = "session-chatter-2290";
  const outcome = compileTranscript(`Decision: Keep the curve id\nDetails: The curve id is the record.\n\n${marker}`);
  assert.equal(outcome.ok, true);
  assert.equal(outcome.proposals.length, 1);
  assert.equal(JSON.stringify(outcome.state).includes(marker), false);
  assert.equal(JSON.stringify(outcome.state).includes("The curve id is the record."), true);
  resetDesk();
});
