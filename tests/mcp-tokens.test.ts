import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { handleMcp, MCP_CLIENT_ACCEPT } from "../src/lib/mcp/handle";
import { MemoryRecallStore } from "../src/lib/recall/store";
import { handleCreateToken } from "../src/lib/tokens/handlers";
import { MemoryTokenStore, seededSubscribers } from "../src/lib/tokens/memory-store";
import { FIXTURE_PEPPER } from "./fixtures/hearthline-tokens";

const root = path.resolve(import.meta.dirname, "..");
const NOW = Date.parse("2026-11-24T12:00:00.000Z");

test("MCP lists tools, reads a unit, and checks send_meeting_bot scope", async () => {
  const store = new MemoryTokenStore({ seed: false });
  const recall = new MemoryRecallStore();
  const subscriber = seededSubscribers()[0];
  if (!subscriber) throw new Error("missing subscriber");
  const reader = await issue(store, subscriber, ["units:read"]);
  const sender = await issue(store, subscriber, ["meetings:write"]);
  let network = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    network += 1;
    throw new Error("network");
  };
  const calls: string[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push(String(input));
    assert.equal(new Headers(init?.headers).get("authorization"), "Token recall-test-key");
    return Response.json({ id: "recall-bot-mcp" });
  };
  try {
    const listed = await rpc(reader, store, recall, fetchImpl, {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {},
    });
    assert.equal(listed.status, 200);
    const listedBody = (await listed.json()) as { result?: { tools?: Array<{ name: string }> } };
    assert.deepEqual(
      listedBody.result?.tools?.map((tool) => tool.name).sort(),
      ["get_unit", "list_action_items", "list_entities", "search_units", "send_meeting_bot"].sort(),
    );
    const before = JSON.stringify(await recall.snapshot());
    const found = await rpc(reader, store, recall, fetchImpl, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "search_units", arguments: { query: "Kiln" } },
    });
    assert.equal(found.status, 200);
    const foundBody = (await found.json()) as { result?: { content?: Array<{ text: string }> } };
    const text = foundBody.result?.content?.[0]?.text ?? "";
    assert.match(text, /kiln-ledger-split|Kiln Ledger|Kilnwatch/);
    assert.equal(JSON.stringify(await recall.snapshot()), before);
    assert.equal(calls.length, 0);

    const denied = await rpc(reader, store, recall, fetchImpl, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "send_meeting_bot",
        arguments: { meetingUrl: "https://meet.example.test/hearthline", title: "Kilnwatch release standup" },
      },
    });
    assert.equal(denied.status, 403);
    assert.equal(((await denied.json()) as { error: string }).error, "insufficient_scope");
    assert.equal(calls.length, 0);

    const { logs } = await capture(async () => {
      const sent = await rpc(sender, store, recall, fetchImpl, {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "send_meeting_bot",
          arguments: { meetingUrl: "https://meet.example.test/hearthline", title: "Kilnwatch release standup" },
        },
      });
      assert.equal(sent.status, 200);
      const sentBody = (await sent.json()) as { result?: { content?: Array<{ text: string }>; isError?: boolean } };
      assert.equal(sentBody.result?.isError, undefined);
      assert.match(sentBody.result?.content?.[0]?.text ?? "", /recall-bot-mcp/);
      assert.equal(calls.length, 1);
      assert.equal(network, 0);
    });
    assert.equal(logs.join("\n").includes(sender), false);
    assert.equal(logs.join("\n").includes(reader), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

async function issue(
  store: MemoryTokenStore,
  subscriber: NonNullable<ReturnType<typeof seededSubscribers>[number]>,
  scopes: string[],
): Promise<string> {
  const response = await handleCreateToken(
    new Request("https://enterprise-mind.local/api/tokens", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ scopes }),
    }),
    { env: env(), store, now: () => NOW, subscriber },
  );
  assert.equal(response.status, 200);
  return ((await response.json()) as { token: string }).token;
}

function rpc(
  token: string,
  store: MemoryTokenStore,
  recall: MemoryRecallStore,
  fetchImpl: typeof fetch,
  body: unknown,
) {
  return handleMcp(
    new Request("https://enterprise-mind.local/api/mcp", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        accept: MCP_CLIENT_ACCEPT,
      },
      body: JSON.stringify(body),
    }),
    {
      env: env(),
      store,
      now: () => NOW,
      root,
      fetch: fetchImpl,
      recallStore: recall,
      recall: {
        sleep: async () => undefined,
        schedule() {
          return undefined;
        },
      },
    },
  );
}

function env(): NodeJS.ProcessEnv {
  return {
    FLUX_TOKEN_PEPPER: FIXTURE_PEPPER,
    FLUX_SUBSCRIPTION_ACTIVE: "true",
    RECALL_API_KEY: "recall-test-key",
    RECALL_REGION: "us-east-1",
    NEXT_PUBLIC_SUPABASE_URL: "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
  };
}

async function capture<T>(fn: () => Promise<T>): Promise<{ result: T; logs: string[] }> {
  const logs: string[] = [];
  const methods = ["log", "info", "warn", "error", "debug"] as const;
  const original = new Map<(typeof methods)[number], typeof console.log>();
  for (const method of methods) {
    original.set(method, console[method]);
    console[method] = (...args: unknown[]) => {
      logs.push(args.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).join(" "));
    };
  }
  try {
    return { result: await fn(), logs };
  } finally {
    for (const method of methods) {
      const restore = original.get(method);
      if (restore) console[method] = restore;
    }
  }
}
