import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { signRecallBody } from "../src/lib/recall/signature";
import type { RecallDeps } from "../src/lib/recall/deps";
import { processRecallEvent, type RecallEvent } from "../src/lib/recall/jobs";
import { MemoryRecallStore } from "../src/lib/recall/store";
import { handleRecallWebhook } from "../src/lib/recall/webhook";
import { validateRepository } from "../src/lib/validate-content";

const root = path.resolve(import.meta.dirname, "..");
const NOW = Date.parse("2026-11-24T12:00:00Z");
const secret = `whsec_${randomBytes(24).toString("base64")}`;
const VERBATIM = "The glaze notebook stays disconnected and this exact sentence must stay out of storage.";
const transcriptBytes = fs.readFileSync(path.join(root, "tests/fixtures/kilnwatch-standup-transcript.json"));
const deniedBytes = fs.readFileSync(path.join(root, "tests/fixtures/denied-meeting-transcript.json"));

test("transcript.done extracts two actions and one decision without keeping the transcript", async () => {
  const store = new MemoryRecallStore();
  const catalog = copyCatalog();
  await store.createMeeting({
    id: "meeting.kilnwatch-release-standup",
    title: "Kilnwatch release standup",
    projectId: "project.kilnwatch",
    calendarEventId: null,
    decisionId: null,
    meetingUrl: null,
    startsAt: null,
  });
  await store.createBot({
    id: "bot.local",
    meetingId: "meeting.kilnwatch-release-standup",
    recallBotId: "recall-bot-hearth",
    status: "in_call_recording",
    joinAt: null,
  });

  const urls: string[] = [];
  const originalFetch = globalThis.fetch;
  const previousKey = process.env.EXTRACTION_MODEL_API_KEY;
  const previousBase = process.env.EXTRACTION_MODEL_BASE_URL;
  process.env.EXTRACTION_MODEL_API_KEY = "sk-test";
  process.env.EXTRACTION_MODEL_BASE_URL = "https://example.invalid/v1";
  process.env.LLM_ENABLED = "false";
  globalThis.fetch = async () => {
    throw new Error("model_network_forbidden");
  };

  const queued: Array<() => Promise<void>> = [];
  try {
    const raw = JSON.stringify({
      event: "transcript.done",
      data: {
        data: { code: "done", sub_code: null },
        transcript: { id: "tr_hearth" },
        recording: { id: "rec_hearth" },
        bot: { id: "recall-bot-hearth" },
      },
    });
    const response = await handleRecallWebhook(signed(raw), deps(store, catalog, recallFetch(urls), (work) => queued.push(work)));
    assert.equal(response.status, 200);
    assert.deepEqual(urls, []);
    assert.equal(queued.length, 1);
    await queued[0]?.();
  } finally {
    globalThis.fetch = originalFetch;
    restore("EXTRACTION_MODEL_API_KEY", previousKey);
    restore("EXTRACTION_MODEL_BASE_URL", previousBase);
    delete process.env.LLM_ENABLED;
  }

  assert.ok(urls.every((url) => !/openai|anthropic|chat\/completions|generativelanguage|api\.github\.com/i.test(url)));
  assert.ok(urls.some((url) => url === "https://us-east-1.recall.ai/api/v1/transcript/tr_hearth/"));
  const snapshot = await store.snapshot();
  const persisted = JSON.stringify(snapshot);
  assert.equal(snapshot.actionItems.length, 2);
  assert.equal(snapshot.decisions.length, 1);
  assert.equal(snapshot.artifacts.length, 1);
  assert.equal(snapshot.artifacts[0]?.segmentCount, 4);
  assert.deepEqual(snapshot.artifacts[0]?.speakers, ["Catalog editor", "Calibration owner", "Studio lead"]);
  assert.equal(persisted.includes(VERBATIM), false);
  assert.equal(persisted.toLowerCase().includes("feld"), false);
  const conversation = fs.readFileSync(path.join(catalog, snapshot.artifacts[0]?.conversationUnitPath ?? ""), "utf8");
  const decision = fs.readFileSync(path.join(catalog, snapshot.artifacts[0]?.decisionUnitPath ?? ""), "utf8");
  const triage = fs.readFileSync(path.join(catalog, "_control/triage.md"), "utf8");
  assert.equal(conversation.includes(VERBATIM), false);
  assert.equal(decision.includes(VERBATIM), false);
  assert.equal(triage.includes(VERBATIM), false);
  assert.match(conversation, /## Summary/);
  assert.match(conversation, /type: OQ/);
  assert.match(decision, /## Decision/);
  assert.match(decision, /type: DEC/);
  assert.match(snapshot.artifacts[0]?.conversationUnitPath ?? "", /^projects\/kilnwatch\/units\/kilnwatch-mtg[0-9a-f]{8}-OQ-001\.md$/);
  assert.match(triage, /unlabeled discarded/);
  assert.deepEqual(validateRepository(catalog), []);

  const unitsDir = path.join(catalog, "projects/kilnwatch/units");
  const beforeUnits = fs.readdirSync(unitsDir);
  await processRecallEvent(transcriptEvent(), deps(store, catalog, recallFetch(urls), () => undefined));
  assert.equal(snapshot.actionItems.length, 2);
  assert.deepEqual(fs.readdirSync(unitsDir), beforeUnits);
  assert.equal((await store.snapshot()).artifacts.length, 1);
});

test("a denied transcript writes nothing and an enabled model flag makes no network call", async () => {
  const store = new MemoryRecallStore();
  const catalog = copyCatalog();
  const urls: string[] = [];
  await processRecallEvent(transcriptEvent("tr_denied"), deps(store, catalog, deniedFetch(urls), () => undefined));
  const snapshot = JSON.stringify(await store.snapshot());
  assert.equal(snapshot.includes("Feld"), false);
  assert.equal((await store.snapshot()).artifacts.length, 0);
  assert.equal((await store.snapshot()).actionItems.length, 0);
  assert.equal(fs.readdirSync(path.join(catalog, "projects/kilnwatch/units")).length, 5);
  assert.equal(fs.readFileSync(path.join(catalog, "_control/triage.md"), "utf8").includes("Feld"), false);

  const blocked = new MemoryRecallStore();
  await assert.rejects(
    processRecallEvent(transcriptEvent(), deps(blocked, catalog, recallFetch(urls), () => undefined, { LLM_ENABLED: "true" })),
    /llm_disabled_required/,
  );
  assert.deepEqual(urls.filter((url) => url.includes("example.invalid")), []);
  assert.equal((await blocked.snapshot()).artifacts.length, 0);
});

test("bot status, recording.done, and transcript.failed do not download a transcript", async () => {
  const store = new MemoryRecallStore();
  await store.createBot({
    id: "bot.local",
    meetingId: "meeting.1",
    recallBotId: "recall-bot-hearth",
    status: "joining",
    joinAt: null,
  });
  await store.createMeeting({
    id: "meeting.1",
    title: "Meeting",
    projectId: "project.kilnwatch",
    calendarEventId: null,
    decisionId: null,
    meetingUrl: null,
    startsAt: null,
  });
  const urls: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    urls.push(String(input));
    throw new Error("model_network_forbidden");
  };
  await processRecallEvent(
    { webhookId: "msg_status", event: "bot.in_call_recording", botId: "recall-bot-hearth", transcriptId: "", recordingId: "", statusCode: "in_call_recording" },
    deps(store, root, fetchImpl, () => undefined),
  );
  await processRecallEvent(
    { webhookId: "msg_rec", event: "recording.done", botId: "recall-bot-hearth", transcriptId: "", recordingId: "rec_hearth", statusCode: "done" },
    deps(store, root, fetchImpl, () => undefined),
  );
  await processRecallEvent(
    { webhookId: "msg_fail", event: "transcript.failed", botId: "recall-bot-hearth", transcriptId: "tr_hearth", recordingId: "", statusCode: "failed" },
    deps(store, root, fetchImpl, () => undefined),
  );
  assert.deepEqual(urls, []);
  const snapshot = await store.snapshot();
  assert.equal(snapshot.bots[0]?.status, "failed");
  assert.equal(snapshot.artifacts.length, 1);
  assert.equal(snapshot.artifacts[0]?.kind, "recording");
  assert.equal(JSON.stringify(snapshot).includes(VERBATIM), false);
});

test("a GitHub token opens a draft pull request", async () => {
  const store = new MemoryRecallStore();
  const catalog = copyCatalog();
  await store.createMeeting({
    id: "meeting.kilnwatch-release-standup",
    title: "Kilnwatch release standup",
    projectId: "project.kilnwatch",
    calendarEventId: null,
    decisionId: null,
    meetingUrl: null,
    startsAt: null,
  });
  await store.createBot({
    id: "bot.local",
    meetingId: "meeting.kilnwatch-release-standup",
    recallBotId: "recall-bot-hearth",
    status: "done",
    joinAt: null,
  });
  const pulls: { draft?: boolean }[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("/api/v1/transcript/")) {
      return Response.json({ id: "tr_hearth", data: { download_url: "https://downloads.hearthline.test/kilnwatch.json" } });
    }
    if (url.includes("downloads.hearthline.test")) return new Response(transcriptBytes);
    if (url.includes("/git/ref/heads/main")) return Response.json({ object: { sha: "basesha" } });
    if (url.includes("/git/ref/heads/flux/")) return new Response("missing", { status: 404 });
    if (url.endsWith("/git/blobs")) return Response.json({ sha: `blob${pulls.length}${url.length}` });
    if (url.endsWith("/git/trees")) return Response.json({ sha: "treesha" });
    if (url.endsWith("/git/commits")) return Response.json({ sha: "commitsha" });
    if (url.endsWith("/git/refs")) return Response.json({ ref: "refs/heads/flux/meeting" });
    if (url.endsWith("/pulls")) {
      const body = JSON.parse(String(init?.body)) as { draft?: boolean };
      pulls.push(body);
      return Response.json({ html_url: "https://github.com/hearthline/enterprise-mind/pull/9", draft: body.draft });
    }
    throw new Error(`unexpected ${url}`);
  };
  await processRecallEvent(
    transcriptEvent(),
    deps(store, catalog, fetchImpl, () => undefined, {
      FLUX_GITHUB_TOKEN: "github-test-token",
      GITHUB_REPOSITORY: "hearthline/enterprise-mind",
    }),
  );
  assert.equal(pulls.length, 1);
  assert.equal(pulls[0]?.draft, true);
  assert.equal((await store.snapshot()).actionItems.length, 2);
  assert.equal((await store.snapshot()).decisions.length, 1);
  assert.equal(JSON.stringify(await store.snapshot()).includes(VERBATIM), false);
});

function transcriptEvent(transcriptId = "tr_hearth"): RecallEvent {
  return {
    webhookId: "msg_done",
    event: "transcript.done",
    botId: "recall-bot-hearth",
    transcriptId,
    recordingId: "rec_hearth",
    statusCode: "done",
  };
}

function signed(raw: string): Request {
  const timestamp = String(Math.floor(NOW / 1000));
  const signature = signRecallBody({ secret, id: "msg_done", timestamp, rawBody: raw });
  return new Request("https://enterprise-mind.local/api/webhooks/recall", {
    method: "POST",
    headers: {
      "webhook-id": "msg_done",
      "webhook-timestamp": timestamp,
      "webhook-signature": signature,
      "content-type": "application/json",
    },
    body: raw,
  });
}

function deps(
  store: MemoryRecallStore,
  catalog: string,
  fetchImpl: typeof fetch,
  schedule: (work: () => Promise<void>) => void,
  extra: Partial<NodeJS.ProcessEnv> = {},
): RecallDeps {
  return {
    env: {
      NODE_ENV: "test",
      RECALL_WORKSPACE_SECRET: secret,
      RECALL_API_KEY: "recall-test-key",
      RECALL_REGION: "us-east-1",
      RECALL_DOWNLOAD_HOSTS: "downloads.hearthline.test",
      LLM_ENABLED: "false",
      EXTRACTION_MODEL_API_KEY: "sk-test",
      EXTRACTION_MODEL_BASE_URL: "https://example.invalid/v1",
      ...extra,
    },
    fetch: fetchImpl,
    sleep: async () => undefined,
    now: () => NOW,
    store,
    root: catalog,
    schedule,
  };
}

function recallFetch(urls: string[]): typeof fetch {
  return async (input) => {
    const url = String(input);
    urls.push(url);
    if (url === "https://us-east-1.recall.ai/api/v1/transcript/tr_hearth/") {
      return Response.json({
        id: "tr_hearth",
        recording: { id: "rec_hearth" },
        data: { download_url: "https://downloads.hearthline.test/kilnwatch.json" },
      });
    }
    if (url === "https://downloads.hearthline.test/kilnwatch.json") return new Response(transcriptBytes);
    throw new Error(`unexpected ${url}`);
  };
}

function deniedFetch(urls: string[]): typeof fetch {
  return async (input) => {
    const url = String(input);
    urls.push(url);
    if (url.includes("/api/v1/transcript/")) {
      return Response.json({ id: "tr_denied", data: { download_url: "https://downloads.hearthline.test/denied.json" } });
    }
    if (url.includes("downloads.hearthline.test")) return new Response(deniedBytes);
    throw new Error(`unexpected ${url}`);
  };
}

function copyCatalog(): string {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), "flux-recall-"));
  for (const relative of ["ontology", "projects", "comps", "_control"]) {
    fs.cpSync(path.join(root, relative), path.join(dest, relative), { recursive: true });
  }
  fs.copyFileSync(path.join(root, "INDEX.md"), path.join(dest, "INDEX.md"));
  fs.mkdirSync(path.join(dest, "supabase/migrations"), { recursive: true });
  fs.copyFileSync(path.join(root, "supabase/seed_entities.sql"), path.join(dest, "supabase/seed_entities.sql"));
  fs.copyFileSync(
    path.join(root, "supabase/migrations/20261123120000_entities.sql"),
    path.join(dest, "supabase/migrations/20261123120000_entities.sql"),
  );
  return dest;
}

function restore(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
