import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isConfiguredSecret } from "../env";

export const TOKEN_PREFIX = "flux_";
const TOKEN_BYTES = 32;

export function tokenPepper(env: NodeJS.ProcessEnv): string {
  const pepper = env.FLUX_TOKEN_PEPPER;
  if (!isConfiguredSecret(pepper)) {
    throw new TokenAuthError("missing_token_pepper", 503);
  }
  return pepper.trim();
}

export function generatePlaintextToken(): string {
  return `${TOKEN_PREFIX}${randomBytes(TOKEN_BYTES).toString("base64url")}`;
}

export function tokenLast4(plaintext: string): string {
  return plaintext.slice(-4);
}

export function hashToken(plaintext: string, pepper: string): string {
  return createHmac("sha256", pepper).update(plaintext).digest("hex");
}

export function timingSafeEqualText(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) {
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

export function verifyTokenHash(plaintext: string, storedHash: string, pepper: string): boolean {
  const computed = hashToken(plaintext, pepper);
  return timingSafeEqualText(computed, storedHash);
}

export class TokenAuthError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
    this.name = "TokenAuthError";
  }
}
