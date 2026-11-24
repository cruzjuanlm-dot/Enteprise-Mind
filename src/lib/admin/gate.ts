import { createHmac } from "node:crypto";
import { isConfiguredSecret } from "../env";
import { timingSafeEqualText } from "../tokens/crypto";
import { readBearer } from "../tokens/authenticate";
import { HEARTHLINE_ADMIN_ID } from "../tokens/seed-meta";

export const ADMIN_COOKIE = "flux_admin";
export const ADMIN_SUBSCRIBER_ID = HEARTHLINE_ADMIN_ID;

export type AdminGate =
  | { ok: true }
  | { ok: false; status: 403; code: "admin_unconfigured" | "admin_forbidden" };

export function adminSessionValue(secret: string): string {
  return createHmac("sha256", secret).update("flux-admin-session").digest("hex");
}

export function adminGateDecision(input: {
  env: NodeJS.ProcessEnv;
  authorizationHeader: string | null;
  adminCookie: string | null;
  hasAdminRole: boolean;
}): AdminGate {
  const secret = input.env.FLUX_ADMIN_SECRET;
  if (!isConfiguredSecret(secret)) {
    return { ok: false, status: 403, code: "admin_unconfigured" };
  }
  const expected = secret.trim();
  const bearer = bearerFromHeader(input.authorizationHeader);
  const bearerOk = Boolean(bearer && !bearer.startsWith("flux_") && timingSafeEqualText(bearer, expected));
  const cookieOk = Boolean(
    input.adminCookie && timingSafeEqualText(input.adminCookie, adminSessionValue(expected)),
  );
  if (!bearerOk && !cookieOk) return { ok: false, status: 403, code: "admin_forbidden" };
  if (!input.hasAdminRole) return { ok: false, status: 403, code: "admin_forbidden" };
  return { ok: true };
}

function bearerFromHeader(header: string | null): string | null {
  if (!header) return null;
  return readBearer(new Request("https://enterprise-mind.local/admin", { headers: { authorization: header } }));
}
