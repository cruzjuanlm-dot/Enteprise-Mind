import assert from "node:assert/strict";
import test from "node:test";
import { FIXTURES } from "../src/lib/fixtures";
import { resetMemoryRepository } from "../src/lib/memory-repository";
import { ingest, runExtraction } from "../src/lib/pipeline";
import { SAMPLE_TRANSCRIPT } from "../src/lib/sample";

async function setup() {
  const repo = resetMemoryRepository();
  const reviewer = await repo.actorFor(FIXTURES.reviewer);
  const member = await repo.actorFor(FIXTURES.member);
  const admin = await repo.actorFor(FIXTURES.admin);
  const outsider = await repo.actorFor(FIXTURES.outsider);
  assert.ok(reviewer && member && admin && outsider);
  return { repo, reviewer, member, admin, outsider };
}

test("ingest extracts proposals and review files only accepted units", async () => {
  const { repo, reviewer, member, admin, outsider } = await setup();
  const result = await ingest(repo, reviewer, {
    title: "Weekly design review",
    projectId: FIXTURES.rolloutProject,
    sourceExternalId: "meeting-1",
    content: SAMPLE_TRANSCRIPT,
  });
  assert.equal(result.status, 202);
  assert.ok(result.enqueueJobId);
  await runExtraction(repo, result.enqueueJobId);

  const job = await repo.getJob(result.enqueueJobId);
  assert.equal(job?.status, "ready_for_review");
  const events = await repo.listJobEvents(reviewer, result.enqueueJobId);
  assert.deepEqual(
    events.map((event) => event.status),
    ["received", "stored", "extracting", "ready_for_review"],
  );

  const proposed = await repo.listUnits(reviewer, "proposed");
  assert.equal(proposed.length, 2);
  assert.equal(await repo.listUnits(member, "proposed").then((units) => units.length), 0);
  assert.equal(await repo.listUnits(outsider, "proposed").then((units) => units.length), 0);

  const decision = proposed.find((unit) => unit.unitType === "design_decision");
  const task = proposed.find((unit) => unit.unitType === "pending_task");
  assert.ok(decision && task);
  await repo.reviewUnit(reviewer, decision.id, "accept");
  await repo.reviewUnit(reviewer, task.id, "reject");

  const accepted = await repo.listProjectUnits(member, FIXTURES.rolloutProject);
  assert.equal(accepted.length, 1);
  assert.equal(accepted[0]?.title, decision.title);
  assert.equal(await repo.listProjectUnits(outsider, FIXTURES.rolloutProject).then((units) => units.length), 0);
  await assert.rejects(() => repo.reviewUnit(member, task.id, "accept"), /not_found|not_proposed|forbidden/);

  const projects = await repo.listProjects(reviewer);
  assert.deepEqual(projects.map((project) => project.name), ["Pilot rollout"]);
  const adminProjects = await repo.listProjects(admin);
  assert.ok(adminProjects.some((project) => project.name === "Restricted project"));

  const again = await ingest(repo, reviewer, {
    projectId: FIXTURES.rolloutProject,
    sourceExternalId: "meeting-1",
    content: SAMPLE_TRANSCRIPT,
  });
  assert.equal(again.status, 200);
  assert.equal(again.body.idempotent, true);
  assert.equal((await repo.listUnitsForTranscript(result.body.transcriptId!)).length, 2);
});

test("rerun keeps accepted units and does not publish duplicates", async () => {
  const { repo, reviewer } = await setup();
  const result = await ingest(repo, reviewer, {
    projectId: FIXTURES.rolloutProject,
    sourceExternalId: "meeting-2",
    content: SAMPLE_TRANSCRIPT,
  });
  await runExtraction(repo, result.enqueueJobId!);
  const [decision] = await repo.listUnits(reviewer, "proposed");
  await repo.reviewUnit(reviewer, decision.id, "accept");
  const rerun = await ingest(repo, reviewer, {
    projectId: FIXTURES.rolloutProject,
    sourceExternalId: "meeting-2",
    content: SAMPLE_TRANSCRIPT,
    rerun: true,
  });
  assert.equal(rerun.status, 202);
  await runExtraction(repo, rerun.enqueueJobId!);
  const transcriptUnits = await repo.listUnitsForTranscript(result.body.transcriptId!);
  const accepted = transcriptUnits.filter((unit) => unit.reviewState === "accepted");
  assert.equal(accepted.length, 1);
  assert.equal(transcriptUnits.filter((unit) => unit.title === decision.title).length, 1);
});

test("empty transcripts are quarantined and unauthorized callers store nothing", async () => {
  const { repo, reviewer, outsider } = await setup();
  const empty = await ingest(repo, reviewer, { content: "  ", sourceExternalId: "empty-1" });
  assert.equal(empty.status, 422);
  assert.equal(empty.body.error, "empty_body");
  const transcript = await repo.getTranscript(empty.body.transcriptId!);
  assert.equal(transcript?.status, "quarantined");
  await runExtraction(repo, empty.body.jobId!);
  assert.equal((await repo.listUnitsForTranscript(transcript!.id)).length, 0);
  assert.equal((await repo.getJob(empty.body.jobId!))?.failureReason, "empty_body");

  await assert.rejects(
    () => ingest(repo, outsider, { content: SAMPLE_TRANSCRIPT, tenantSlug: "pilot" }),
    /not_a_member/,
  );
  await assert.rejects(
    () =>
      ingest(repo, reviewer, {
        content: SAMPLE_TRANSCRIPT,
        projectId: FIXTURES.restrictedProject,
      }),
    /forbidden/,
  );
});
