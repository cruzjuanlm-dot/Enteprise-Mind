import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import type { RecallDeps } from "../recall/deps";
import { handleCreateBot } from "../recall/create-bot";
import type { RecallStore } from "../recall/store";
import { authenticateBearer, tokenErrorResponse } from "../tokens/authenticate";
import type { TokenStore } from "../tokens/store";
import { listCatalogActionItems, listCatalogEntities, MCP_TOOL_SCOPES, readUnit, searchUnits, type McpToolName } from "./catalog";

const MCP_ACCEPT = "application/json, text/event-stream";

export type McpDeps = {
  env: NodeJS.ProcessEnv;
  store: TokenStore;
  now: () => number;
  root: string;
  fetch: typeof fetch;
  recallStore: RecallStore;
  recall: Pick<RecallDeps, "sleep" | "schedule">;
};

export async function handleMcp(request: Request, deps: McpDeps): Promise<Response> {
  if (request.method !== "POST" && request.method !== "GET" && request.method !== "DELETE") {
    return Response.json({ error: "method_not_allowed" }, { status: 405 });
  }
  let scopes: string[];
  try {
    const auth = await authenticateBearer(request, {
      env: deps.env,
      store: deps.store,
      now: deps.now(),
      requireSubscription: true,
    });
    scopes = auth.scopes;
  } catch (error) {
    return tokenErrorResponse(error);
  }
  if (request.method !== "POST") return openTransport(request, deps);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  const denied = scopeResponse(body, scopes);
  if (denied) return denied;
  return openTransport(request, deps, body);
}

async function openTransport(request: Request, deps: McpDeps, body?: unknown): Promise<Response> {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  transport.onerror = () => undefined;
  const server = buildServer(deps, request);
  try {
    await server.connect(transport);
    return await transport.handleRequest(request, body === undefined ? undefined : { parsedBody: body });
  } finally {
    await server.close().catch(() => undefined);
  }
}

export function scopeResponse(body: unknown, scopes: readonly string[]): Response | null {
  if (!body || typeof body !== "object") return null;
  const message = body as { method?: unknown; params?: { name?: unknown } };
  if (message.method !== "tools/call") return null;
  const name = message.params?.name;
  if (typeof name !== "string" || !isToolName(name)) {
    return Response.json({ error: "unknown_tool" }, { status: 400 });
  }
  const required = MCP_TOOL_SCOPES[name];
  if (!scopes.includes(required)) {
    return Response.json({ error: "insufficient_scope", scope: required }, { status: 403 });
  }
  return null;
}

function isToolName(name: string): name is McpToolName {
  return name in MCP_TOOL_SCOPES;
}

function buildServer(deps: McpDeps, request: Request): McpServer {
  const server = new McpServer({ name: "flux", version: "0.1.0" });
  server.registerTool(
    "search_units",
    {
      description: "Search Hearthline knowledge units by title or id. Read only.",
      inputSchema: { query: z.string().min(1).max(200) },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ query }) => jsonResult(searchUnits(query, deps.root)),
  );
  server.registerTool(
    "get_unit",
    {
      description: "Read one Hearthline knowledge unit by id. Read only.",
      inputSchema: { id: z.string().min(1).max(120) },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ id }) => {
      const unit = readUnit(id, deps.root);
      if (!unit) return { isError: true, content: [{ type: "text" as const, text: "not_found" }] };
      return jsonResult(unit);
    },
  );
  server.registerTool(
    "list_entities",
    {
      description: "List Hearthline catalog entities. Read only.",
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async () => jsonResult(await listCatalogEntities(deps.env, deps.root)),
  );
  server.registerTool(
    "list_action_items",
    {
      description: "List Hearthline action items. Read only.",
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async () => jsonResult(listCatalogActionItems(deps.root)),
  );
  server.registerTool(
    "send_meeting_bot",
    {
      description: "Send the meeting bot. Requires the meetings:write scope. Recall is called only by the server.",
      inputSchema: {
        meetingUrl: z.string().min(1).max(2000),
        title: z.string().min(1).max(200).optional(),
        projectId: z.string().min(1).max(120).optional(),
        startsAt: z.string().min(1).max(40).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async (args) => {
      const botRequest = new Request("https://enterprise-mind.local/api/bots", {
        method: "POST",
        headers: {
          authorization: request.headers.get("authorization") ?? "",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          meetingUrl: args.meetingUrl,
          title: args.title,
          projectId: args.projectId,
          startsAt: args.startsAt,
        }),
      });
      const response = await handleCreateBot(botRequest, {
        env: deps.env,
        fetch: deps.fetch,
        sleep: deps.recall.sleep,
        now: deps.now,
        store: deps.recallStore,
        root: deps.root,
        schedule: deps.recall.schedule,
        tokenStore: deps.store,
      });
      const payload = (await response.json().catch(() => ({ error: "invalid_response" }))) as { error?: string };
      if (!response.ok) {
        return { isError: true, content: [{ type: "text" as const, text: payload.error ?? "bot_failed" }] };
      }
      return jsonResult(payload);
    },
  );
  return server;
}

function jsonResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}

export const MCP_CLIENT_ACCEPT = MCP_ACCEPT;
