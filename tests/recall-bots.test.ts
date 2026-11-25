import assert from "node:assert/strict";
import test from "node:test";
import { CREATE_BOT_BACKOFF_MS } from "../src/lib/recall/config";
import { handleCreateBot } from "../src/lib/recall/create-bot";
import type { RecallDeps } from "../src/lib/recall/deps";
import { artifactInsert, MemoryRecallStore, type ArtifactRecord } from "../src/lib/recall/store";

const NOW = Date.parse("2026-11-24T12:00:00Z");

test("Create Bot returns 200, 503, 403, and 507", async () => {
  const store = new MemoryRecallStore();
  const calls: { url: string; authorization: string; body: { join_at?: string; recording_config?: { transcript?: { provider?: { recallai_streaming?: object } } } } }[] = [];
  let mode: "ok" | "capacity" = "ok";
  const fetchImpl: typeof fetch = async (input, init) => {
    const body = JSON.parse(String(init?.body)) as (typeof calls)[number]["body"];
    calls.push({
      url: String(input),
      authorization: new Headers(init?.headers).get("authorization") ?? "",
      body,
    });
    if (mode === "capacity") return new Response("full", { status: 507 });
    return Response.json({ id: "recall-bot-hearth" });
  };
  const base = env();

  const created = await handleCreateBot(
    botRequest(base.FLUX_BOTS_AUTH_SECRET, new Date(NOW + 11 * 60 * 1000).toISOString()),
    deps(store, fetchImpl, base),
  );
  assert.equal(created.status, 200);
  const createdBody = (await created.json()) as { recallBotId: string; scheduled: boolean; joinAt: string };
  assert.equal(createdBody.recallBotId, "recall-bot-hearth");
  assert.equal(createdBody.scheduled, true);
  assert.equal(calls[0]?.url, "https://us-east-1.recall.ai/api/v1/bot/");
  assert.equal(calls[0]?.authorization, "Token recall-test-key");
  assert.ok(calls[0]?.body.join_at);
  assert.deepEqual(calls[0]?.body.recording_config?.transcript?.provider?.recallai_streaming, {});
  assert.equal((await store.snapshot()).bots.length, 1);

  calls.length = 0;
  const soon = await handleCreateBot(
    botRequest(base.FLUX_BOTS_AUTH_SECRET, new Date(NOW + 5 * 60 * 1000).toISOString()),
    deps(store, fetchImpl, base),
  );
  assert.equal(soon.status, 200);
  assert.equal(calls[0]?.body.join_at, undefined);

  const missingKey = await handleCreateBot(botRequest(base.FLUX_BOTS_AUTH_SECRET), deps(store, fetchImpl, { ...base, RECALL_API_KEY: "" }));
  assert.equal(missingKey.status, 503);
  assert.equal(calls.length, 1);

  const forbidden = await handleCreateBot(botRequest("wrong-secret"), deps(store, fetchImpl, base));
  assert.equal(forbidden.status, 403);
  const inactive = await handleCreateBot(
    botRequest(base.FLUX_BOTS_AUTH_SECRET),
    deps(store, fetchImpl, { ...base, FLUX_SUBSCRIPTION_ACTIVE: "false" }),
  );
  assert.equal(inactive.status, 403);
  assert.equal(calls.length, 1);

  mode = "capacity";
  const sleeps: number[] = [];
  const capacity = await handleCreateBot(
    botRequest(base.FLUX_BOTS_AUTH_SECRET),
    deps(store, fetchImpl, base, async (ms) => {
      sleeps.push(ms);
    }),
  );
  assert.equal(capacity.status, 507);
  assert.deepEqual(sleeps, [CREATE_BOT_BACKOFF_MS]);
  const snapshot = await store.snapshot();
  assert.equal(snapshot.meetings.length, 2);
  assert.equal(snapshot.bots.length, 1);
});

test("artifact rows keep a hash and pointers, not transcript text", () => {
  const artifact: ArtifactRecord = {
    id: "artifact.example",
    meetingId: "meeting.example",
    botId: null,
    kind: "transcript",
    contentSha256: "a".repeat(64),
    segmentCount: 4,
    speakers: ["Catalog editor"],
    recallTranscriptId: "tr_hearth",
    recallRecordingId: "rec_hearth",
    conversationUnitPath: "projects/kilnwatch/units/kilnwatch-mtgexample1-OQ-001.md",
    decisionUnitPath: "projects/kilnwatch/units/kilnwatch-mtgexample1-DEC-001.md",
  };
  assert.deepEqual(Object.keys(artifactInsert(artifact)).sort(), [
    "bot_id",
    "content_sha256",
    "conversation_unit_path",
    "decision_unit_path",
    "id",
    "kind",
    "meeting_id",
    "recall_recording_id",
    "recall_transcript_id",
    "segment_count",
    "speakers",
  ]);
});

function env(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    FLUX_BOTS_AUTH_SECRET: "bots-test-secret",
    FLUX_SUBSCRIPTION_ACTIVE: "true",
    RECALL_API_KEY: "recall-test-key",
    RECALL_REGION: "us-east-1",
  };
}

function botRequest(secret: string | undefined, startsAt?: string): Request {
  return new Request("https://enterprise-mind.local/api/bots", {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret ?? ""}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      meetingUrl: "https://meet.example.test/kilnwatch-standup",
      title: "Kilnwatch release standup",
      projectId: "project.kilnwatch",
      startsAt,
    }),
  });
}

function deps(
  store: MemoryRecallStore,
  fetchImpl: typeof fetch,
  env: NodeJS.ProcessEnv,
  sleep: (ms: number) => Promise<void> = async () => undefined,
): RecallDeps {
  return {
    env,
    fetch: fetchImpl,
    sleep,
    now: () => NOW,
    store,
    root: process.cwd(),
    schedule() {
      throw new Error("create bot does not schedule work");
    },
  };
}
