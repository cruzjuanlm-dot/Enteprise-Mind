import { sameOriginUrl, wantsHtml } from "../http";
import { newAuditId } from "./memory-store";
import { authenticateBearer, newTokenId, tokenErrorResponse } from "./authenticate";
import {
  generatePlaintextToken,
  hashToken,
  tokenLast4,
  tokenPepper,
  TOKEN_PREFIX,
  TokenAuthError,
} from "./crypto";
import { parseScopes, type TokenScope } from "./scopes";
import { toTokenMetadata, type SubscriberRecord, type TokenMetadata, type TokenStore } from "./store";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export type TokenDeps = {
  env: NodeJS.ProcessEnv;
  store: TokenStore;
  now: () => number;
  subscriber: SubscriberRecord;
};

export async function handleCreateToken(request: Request, deps: TokenDeps): Promise<Response> {
  try {
    const body = await readCreateBody(request);
    const pepper = tokenPepper(deps.env);
    const plaintext = generatePlaintextToken();
    const createdAt = new Date(deps.now()).toISOString();
    const expiresAt = body.expiresAt ?? new Date(deps.now() + NINETY_DAYS_MS).toISOString();
    if (Number.isNaN(Date.parse(expiresAt))) throw new TokenAuthError("invalid_request", 400);
    const record = {
      id: newTokenId(),
      subscriberId: deps.subscriber.id,
      workspaceId: deps.subscriber.workspaceId,
      label: body.label,
      tokenHash: hashToken(plaintext, pepper),
      prefix: TOKEN_PREFIX,
      last4: tokenLast4(plaintext),
      scopes: body.scopes,
      expiresAt,
      revokedAt: null,
      lastUsedAt: null,
      createdAt,
    };
    await deps.store.insert(record);
    const metadata = toTokenMetadata(record);
    await deps.store.appendAudit({
      id: newAuditId(),
      actorSubscriberId: deps.subscriber.id,
      action: "token.create",
      target: record.id,
      detail: { prefix: record.prefix, last4: record.last4, scopes: record.scopes },
      createdAt,
    });
    const headers = { "cache-control": "no-store" };
    if (wantsHtml(request)) {
      return new Response(renderTokenOnce(plaintext, metadata), {
        status: 200,
        headers: { ...headers, "content-type": "text/html; charset=utf-8", "referrer-policy": "no-referrer" },
      });
    }
    return Response.json({ token: plaintext, tokenMetadata: metadata }, { status: 200, headers });
  } catch (error) {
    return tokenErrorResponse(error);
  }
}

export async function handleListTokens(deps: TokenDeps): Promise<Response> {
  const tokens = await deps.store.listBySubscriber(deps.subscriber.id);
  return Response.json({ tokens }, { headers: { "cache-control": "no-store" } });
}

export async function handleRevokeToken(request: Request, deps: TokenDeps): Promise<Response> {
  try {
    const id = await readTokenId(request);
    if (!id) throw new TokenAuthError("invalid_request", 400);
    const revokedAt = new Date(deps.now()).toISOString();
    const metadata = await deps.store.revoke(id, deps.subscriber.id, revokedAt);
    if (!metadata) throw new TokenAuthError("not_found", 404);
    await deps.store.appendAudit({
      id: newAuditId(),
      actorSubscriberId: deps.subscriber.id,
      action: "token.revoke",
      target: id,
      detail: { prefix: metadata.prefix, last4: metadata.last4 },
      createdAt: revokedAt,
    });
    if (wantsHtml(request)) {
      return new Response(null, {
        status: 303,
        headers: { location: sameOriginUrl(request, "/tokens").toString() },
      });
    }
    return Response.json({ token: metadata }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return tokenErrorResponse(error);
  }
}

export async function handleBearer(
  request: Request,
  options: Parameters<typeof authenticateBearer>[1],
): Promise<Response | Awaited<ReturnType<typeof authenticateBearer>>> {
  try {
    return await authenticateBearer(request, options);
  } catch (error) {
    return tokenErrorResponse(error);
  }
}

async function readCreateBody(request: Request): Promise<{ label: string; scopes: TokenScope[]; expiresAt: string | null }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      throw new TokenAuthError("invalid_request", 400);
    }
    if (!payload || typeof payload !== "object") throw new TokenAuthError("invalid_request", 400);
    const record = payload as Record<string, unknown>;
    const scopes = parseScopes(record.scopes);
    if (!scopes) throw new TokenAuthError("invalid_request", 400);
    const label = typeof record.label === "string" && record.label.trim() ? record.label.trim().slice(0, 80) : "Personal token";
    const expiresAt = typeof record.expiresAt === "string" && record.expiresAt.trim() ? record.expiresAt.trim() : null;
    return { label, scopes, expiresAt };
  }
  const form = await request.formData();
  const selected = form.getAll("scopes").filter((value): value is string => typeof value === "string");
  const scopes = parseScopes(selected);
  if (!scopes) throw new TokenAuthError("invalid_request", 400);
  const labelValue = form.get("label");
  const label = typeof labelValue === "string" && labelValue.trim() ? labelValue.trim().slice(0, 80) : "Personal token";
  const expiry = form.get("expiresAt");
  const expiresAt = typeof expiry === "string" && expiry.trim() ? new Date(expiry).toISOString() : null;
  if (typeof expiry === "string" && expiry.trim() && Number.isNaN(Date.parse(expiresAt ?? ""))) {
    throw new TokenAuthError("invalid_request", 400);
  }
  return { label, scopes, expiresAt };
}

async function readTokenId(request: Request): Promise<string | null> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const payload = (await request.json()) as { id?: unknown };
    return typeof payload.id === "string" && payload.id.trim() ? payload.id.trim() : null;
  }
  const form = await request.formData();
  const id = form.get("id");
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

function renderTokenOnce(plaintext: string, metadata: TokenMetadata): string {
  const scopes = metadata.scopes.join(", ");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Enterprise Mind</title>
  <style>
    body { margin: 0; font-family: "Avenir Next", "Segoe UI", sans-serif; background: #f3efe6; color: #1d1a15; }
    main { max-width: 40rem; margin: 0 auto; padding: 1.25rem; }
    code { display: block; overflow-wrap: anywhere; background: #fffdf8; border: 1px solid #ddd4c4; border-radius: 12px; padding: 0.75rem; }
    a { color: inherit; }
  </style>
</head>
<body>
  <main>
    <h1>Copy this token now</h1>
    <p>This is the only time the token is shown. Enterprise Mind stores a hash, the prefix, and the last four characters.</p>
    <code>${escapeHtml(plaintext)}</code>
    <p>Prefix ${escapeHtml(metadata.prefix)} · last four ${escapeHtml(metadata.last4)} · scopes ${escapeHtml(scopes)}</p>
    <p><a href="/tokens">Back to tokens</a></p>
  </main>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return map[character] ?? character;
  });
}
