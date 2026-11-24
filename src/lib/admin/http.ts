import { sameOriginUrl, wantsHtml } from "../http";
import { isConfiguredSecret } from "../env";
import { timingSafeEqualText } from "../tokens/crypto";
import { newAuditId } from "../tokens/memory-store";
import type { TokenStore } from "../tokens/store";
import { ADMIN_COOKIE, ADMIN_SUBSCRIBER_ID, adminGateDecision, adminSessionValue } from "./gate";

export async function handleAdminSession(
  request: Request,
  deps: { env: NodeJS.ProcessEnv; store: TokenStore; now: () => number },
): Promise<Response> {
  const presented = await readSecret(request);
  if (presented.intent === "signout") {
    return redirectTo(request, "/admin", { "set-cookie": clearAdminCookie() });
  }
  const secret = deps.env.FLUX_ADMIN_SECRET;
  if (!isConfiguredSecret(secret)) {
    if (presented.html) return redirectTo(request, "/admin");
    return Response.json({ error: "admin_unconfigured" }, { status: 403 });
  }
  const hasAdminRole = await deps.store.hasAdminRole(ADMIN_SUBSCRIBER_ID);
  const matches = timingSafeEqualText(presented.secret, secret.trim());
  if (!hasAdminRole || !matches) {
    if (presented.html) return redirectTo(request, "/admin?error=admin_forbidden");
    return Response.json({ error: "admin_forbidden" }, { status: 403 });
  }
  const at = new Date(deps.now()).toISOString();
  await deps.store.appendAudit({
    id: newAuditId(),
    actorSubscriberId: ADMIN_SUBSCRIBER_ID,
    action: "admin.session",
    target: "admin",
    detail: { result: "signed-in" },
    createdAt: at,
  });
  const cookie = adminCookie(adminSessionValue(secret.trim()));
  if (presented.html) {
    return redirectTo(request, "/admin", { "set-cookie": cookie });
  }
  return Response.json({ ok: true }, { status: 200, headers: { "set-cookie": cookie, "cache-control": "no-store" } });
}

export async function handleAdminRevoke(
  request: Request,
  deps: {
    env: NodeJS.ProcessEnv;
    store: TokenStore;
    now: () => number;
    authorizationHeader: string | null;
    adminCookie: string | null;
  },
): Promise<Response> {
  const preliminary = adminGateDecision({
    env: deps.env,
    authorizationHeader: null,
    adminCookie: null,
    hasAdminRole: true,
  });
  if (!preliminary.ok && preliminary.code === "admin_unconfigured") {
    return Response.json({ error: preliminary.code }, { status: preliminary.status });
  }
  const hasAdminRole = await deps.store.hasAdminRole(ADMIN_SUBSCRIBER_ID);
  const decision = adminGateDecision({
    env: deps.env,
    authorizationHeader: deps.authorizationHeader,
    adminCookie: deps.adminCookie,
    hasAdminRole,
  });
  if (!decision.ok) return Response.json({ error: decision.code }, { status: decision.status });
  const id = await readId(request);
  if (!id) return Response.json({ error: "invalid_request" }, { status: 400 });
  const revokedAt = new Date(deps.now()).toISOString();
  const metadata = await deps.store.revokeById(id, revokedAt);
  if (!metadata) return Response.json({ error: "not_found" }, { status: 404 });
  await deps.store.appendAudit({
    id: newAuditId(),
    actorSubscriberId: ADMIN_SUBSCRIBER_ID,
    action: "token.revoke",
    target: id,
    detail: { prefix: metadata.prefix, last4: metadata.last4, via: "admin" },
    createdAt: revokedAt,
  });
  if (wantsHtml(request)) return redirectTo(request, "/admin");
  return Response.json({ token: metadata }, { headers: { "cache-control": "no-store" } });
}

async function readSecret(request: Request): Promise<{ secret: string; intent: string; html: boolean }> {
  const html = wantsHtml(request);
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const payload = (await request.json().catch(() => null)) as { secret?: unknown; intent?: unknown } | null;
    return {
      secret: typeof payload?.secret === "string" ? payload.secret : "",
      intent: typeof payload?.intent === "string" ? payload.intent : "",
      html,
    };
  }
  const form = await request.formData().catch(() => null);
  const secret = form?.get("secret");
  const intent = form?.get("intent");
  return {
    secret: typeof secret === "string" ? secret : "",
    intent: typeof intent === "string" ? intent : "",
    html,
  };
}

async function readId(request: Request): Promise<string> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const payload = (await request.json().catch(() => null)) as { id?: unknown } | null;
    return typeof payload?.id === "string" ? payload.id.trim() : "";
  }
  const form = await request.formData().catch(() => null);
  const id = form?.get("id");
  return typeof id === "string" ? id.trim() : "";
}

function adminCookie(value: string): string {
  return `${ADMIN_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200`;
}

function clearAdminCookie(): string {
  return `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function redirectTo(request: Request, path: string, extra?: Record<string, string>): Response {
  const headers = new Headers(extra);
  headers.set("location", sameOriginUrl(request, path).toString());
  return new Response(null, { status: 303, headers });
}

export function adminCookieFromHeader(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === ADMIN_COOKIE) return rest.join("=");
  }
  return null;
}
