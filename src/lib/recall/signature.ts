import { createHmac, timingSafeEqual } from "node:crypto";
import { WEBHOOK_TOLERANCE_SECONDS } from "./config";
import { RecallError } from "./errors";

export type SignatureHeaders = {
  get(name: string): string | null;
};

/**
 * Recall signs `${id}.${timestamp}.${rawBody}` with HMAC-SHA256.
 * The workspace secret is `whsec_` plus a base64 key.
 * Accept webhook-* and svix-* header names. Compare with timingSafeEqual.
 * Reject timestamps outside a five-minute window.
 */
export function verifyRecallSignature(input: {
  secret: string;
  headers: SignatureHeaders;
  rawBody: string;
  nowMs?: number;
}): void {
  if (!input.secret.startsWith("whsec_")) {
    throw new RecallError("missing_workspace_secret", 503);
  }
  const id = header(input.headers, ["webhook-id", "svix-id"]);
  const timestamp = header(input.headers, ["webhook-timestamp", "svix-timestamp"]);
  const signature = header(input.headers, ["webhook-signature", "svix-signature"]);
  if (!id || !timestamp || !signature) throw new RecallError("invalid_signature", 401);

  const stamped = Number(timestamp);
  if (!Number.isFinite(stamped) || !/^\d+$/.test(timestamp)) {
    throw new RecallError("stale_timestamp", 401);
  }
  const nowSec = Math.floor((input.nowMs ?? Date.now()) / 1000);
  if (Math.abs(nowSec - stamped) > WEBHOOK_TOLERANCE_SECONDS) {
    throw new RecallError("stale_timestamp", 401);
  }

  const key = Buffer.from(input.secret.slice("whsec_".length), "base64");
  if (key.length === 0) throw new RecallError("missing_workspace_secret", 503);
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${input.rawBody}`).digest();
  const candidates = signature.split(" ").map((part) => part.trim()).filter(Boolean);
  let matched = false;
  for (const candidate of candidates) {
    const comma = candidate.indexOf(",");
    if (comma === -1) continue;
    const version = candidate.slice(0, comma);
    const value = candidate.slice(comma + 1);
    if (version !== "v1" || !value) continue;
    const given = Buffer.from(value, "base64");
    if (given.length !== expected.length) continue;
    if (timingSafeEqual(given, expected)) matched = true;
  }
  if (!matched) throw new RecallError("invalid_signature", 401);
}

export function signRecallBody(input: { secret: string; id: string; timestamp: string; rawBody: string }): string {
  const key = Buffer.from(input.secret.slice("whsec_".length), "base64");
  const digest = createHmac("sha256", key).update(`${input.id}.${input.timestamp}.${input.rawBody}`).digest("base64");
  return `v1,${digest}`;
}

function header(headers: SignatureHeaders, names: string[]): string {
  for (const name of names) {
    const value = headers.get(name);
    if (value) return value;
  }
  return "";
}
