import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { signRecallBody, verifyRecallSignature } from "../src/lib/recall/signature";
import { MemoryRecallStore } from "../src/lib/recall/store";
import { handleRecallWebhook } from "../src/lib/recall/webhook";
import type { RecallDeps } from "../src/lib/recall/deps";

const NOW = Date.parse("2026-11-24T12:00:00Z");
const secret = `whsec_${randomBytes(24).toString("base64")}`;

test("HMAC accepts webhook and svix headers and rejects a bad or stale signature", () => {
  const raw = '{"event":"bot.done","data":{"bot":{"id":"bot_1"},"data":{"code":"done"}}}';
  const timestamp = String(Math.floor(NOW / 1000));
  const signature = signRecallBody({ secret, id: "msg_hearth", timestamp, rawBody: raw });

  for (const prefix of ["webhook", "svix"]) {
    verifyRecallSignature({
      secret,
      rawBody: raw,
      nowMs: NOW,
      headers: new Headers({
        [`${prefix}-id`]: "msg_hearth",
        [`${prefix}-timestamp`]: timestamp,
        [`${prefix}-signature`]: `v1,not-the-signature ${signature}`,
      }),
    });
  }

  assert.throws(
    () =>
      verifyRecallSignature({
        secret,
        rawBody: raw,
        nowMs: NOW,
        headers: new Headers({
          "webhook-id": "msg_hearth",
          "webhook-timestamp": timestamp,
          "webhook-signature": signature.replace("v1,", "v1,AAAA"),
        }),
      }),
    /invalid_signature/,
  );

  assert.throws(
    () =>
      verifyRecallSignature({
        secret,
        rawBody: raw,
        nowMs: NOW,
        headers: new Headers({
          "webhook-id": "msg_hearth",
          "webhook-timestamp": String(Math.floor(NOW / 1000) - 301),
          "webhook-signature": signRecallBody({
            secret,
            id: "msg_hearth",
            timestamp: String(Math.floor(NOW / 1000) - 301),
            rawBody: raw,
          }),
        }),
      }),
    /stale_timestamp/,
  );

  const spaced = '{ "event" : "bot.done" }';
  assert.throws(
    () =>
      verifyRecallSignature({
        secret,
        rawBody: spaced,
        nowMs: NOW,
        headers: new Headers({
          "webhook-id": "msg_hearth",
          "webhook-timestamp": timestamp,
          "webhook-signature": signRecallBody({ secret, id: "msg_hearth", timestamp, rawBody: raw }),
        }),
      }),
    /invalid_signature/,
  );
});

test("an invalid webhook writes nothing", async () => {
  const store = new MemoryRecallStore();
  const before = JSON.stringify(await store.snapshot());
  let scheduled = 0;
  const response = await handleRecallWebhook(badRequest(), deps(store, () => {
    scheduled += 1;
  }));
  assert.equal(response.status, 401);
  assert.equal(scheduled, 0);
  assert.equal(JSON.stringify(await store.snapshot()), before);
});

test("signature bytes are compared with timingSafeEqual", () => {
  const file = fs.readFileSync(path.join(import.meta.dirname, "../src/lib/recall/signature.ts"), "utf8");
  assert.match(file, /timingSafeEqual/);
});

function badRequest(): Request {
  return new Request("https://enterprise-mind.local/api/webhooks/recall", {
    method: "POST",
    headers: {
      "webhook-id": "msg_hearth",
      "webhook-timestamp": String(Math.floor(NOW / 1000)),
      "webhook-signature": "v1,aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa=",
    },
    body: '{"event":"transcript.done"}',
  });
}

function deps(store: MemoryRecallStore, schedule: () => void): RecallDeps {
  return {
    env: {
      RECALL_WORKSPACE_SECRET: secret,
      RECALL_API_KEY: "recall-test-key",
      RECALL_REGION: "us-east-1",
      RECALL_DOWNLOAD_HOSTS: "downloads.hearthline.test",
      LLM_ENABLED: "",
    },
    fetch: async () => {
      throw new Error("model_network_forbidden");
    },
    sleep: async () => undefined,
    now: () => NOW,
    store,
    root: process.cwd(),
    schedule: () => schedule(),
  };
}
