import credentialsFile from "../content/credentials.json";
import { getTier } from "./catalog";
import { utcDayNumber } from "./dates";

export type CredentialStatus = "active" | "expired" | "revoked";

export type Credential = {
  id: string;
  holder: string;
  tier: string;
  issued: string;
  expires: string;
  status: CredentialStatus;
};

const ID_PATTERN = /^FLX-[A-Z]-[0-9]{4}$/;

const credentials = credentialsFile.credentials as Credential[];

export function listCredentials(): Credential[] {
  return credentials;
}

export function normalizeCredentialId(raw: string): string {
  return raw.trim().toUpperCase();
}

export type DisplayStatus = "active" | "expired" | "revoked";

export function resolveStatus(
  status: CredentialStatus,
  expires: string,
  asOf: Date,
): DisplayStatus {
  if (status === "revoked") return "revoked";
  if (status === "expired") return "expired";
  if (utcDayNumber(asOf) > utcDayNumber(expires)) return "expired";
  return "active";
}

export type VerifyView =
  | { kind: "empty" }
  | { kind: "error"; id: string }
  | { kind: "unknown"; id: string }
  | {
      kind: "found";
      credential: Credential;
      displayStatus: DisplayStatus;
      tierName: string | null;
      tierSlug: string | null;
    };

export function lookupCredential(raw: string, asOf: Date = new Date()): VerifyView {
  if (raw.trim() === "") return { kind: "empty" };
  const id = normalizeCredentialId(raw);
  if (!ID_PATTERN.test(id)) return { kind: "error", id };
  const credential = credentials.find((item) => item.id === id);
  if (!credential) return { kind: "unknown", id };
  const tier = getTier(credential.tier);
  return {
    kind: "found",
    credential,
    displayStatus: resolveStatus(credential.status, credential.expires, asOf),
    tierName: tier?.name ?? null,
    tierSlug: tier?.slug ?? null,
  };
}
