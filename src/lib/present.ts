import type { FieldPresence, JobStatus, UnitType } from "./domain";

export const UNIT_LABEL: Record<UnitType, string> = {
  architecture: "Architecture",
  design_decision: "Design decision",
  pending_task: "Pending task",
  risk: "Risk",
  open_question: "Open question",
  glossary_term: "Glossary term",
};

export const ERROR_TEXT: Record<string, string> = {
  empty_body: "The transcript was empty, so it was quarantined and not extracted.",
  invalid_format: "The transcript format could not be read. It was quarantined.",
  too_large: "The transcript is over the pilot size limit and was not stored.",
  forbidden: "You do not have access to do that.",
  not_a_member: "You are not a member of that tenant.",
  not_found: "That record is not available.",
  not_proposed: "That unit is no longer waiting for review.",
  not_failed: "Only a failed job can be retried.",
  unauthorized: "Sign in to continue.",
  unknown_project: "That project is not in this tenant.",
  unknown_department: "That department is not in this tenant.",
  invalid_filing: "The filing does not match the project or department.",
  invalid_source: "The source system name is not valid.",
  invalid_captured_at: "The capture time is not a valid date.",
  tenant_required: "Choose a tenant.",
  invalid_action: "Review must accept or reject.",
  internal: "Something went wrong.",
  storage_failed: "The original payload could not be stored.",
  store_failed: "The record could not be stored.",
};

export function errorText(code: string | undefined): string | null {
  if (!code) return null;
  return ERROR_TEXT[code] ?? null;
}

export function statusLabel(status: JobStatus | string): string {
  return status.replaceAll("_", " ");
}

export function knownText(presence: FieldPresence, value: string | null, knownEmpty = "None"): string {
  if (presence === "unknown") return "Unknown";
  return value?.trim() ? value : knownEmpty;
}

export function knownList(presence: FieldPresence, values: string[]): string {
  if (presence === "unknown") return "Unknown";
  return values.length > 0 ? values.join(", ") : "None";
}

export function knownApproval(presence: FieldPresence, value: boolean | null): string {
  if (presence === "unknown" || value === null) return "Unknown";
  return value ? "Required" : "Not required";
}
