import type { FieldPresence, JobStatus, ReviewState, TenantRole, UnitType } from "./domain";

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
  switch (status) {
    case "received":
      return "Received";
    case "stored":
      return "Stored";
    case "extracting":
      return "Extracting";
    case "ready_for_review":
      return "Ready for review";
    case "awaiting_approval":
      return "Awaiting approval";
    case "executing":
      return "Executing";
    case "rolled_back":
      return "Rolled back";
    case "failed":
      return "Failed";
    default:
      return status.replaceAll("_", " ");
  }
}

export function reviewLabel(state: ReviewState): string {
  switch (state) {
    case "proposed":
      return "Proposed";
    case "accepted":
      return "Accepted";
    case "edited":
      return "Edited";
    case "rejected":
      return "Rejected";
    case "merged":
      return "Merged";
  }
}

export function roleLabel(role: TenantRole): string {
  switch (role) {
    case "admin":
      return "Admin";
    case "reviewer":
      return "Reviewer";
    case "approver":
      return "Approver";
    case "member":
      return "Member";
  }
}

export function reviewTone(state: ReviewState): "info" | "success" | "danger" {
  if (state === "rejected") return "danger";
  if (state === "proposed") return "info";
  return "success";
}

export function jobTone(status: JobStatus | string): "info" | "success" | "warning" | "danger" | "neutral" {
  if (status === "failed" || status === "rolled_back") return "danger";
  if (status === "extracting" || status === "executing" || status === "awaiting_approval") return "warning";
  if (status === "ready_for_review") return "info";
  if (status === "received" || status === "stored") return "neutral";
  return "neutral";
}

export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "Unknown";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(date);
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
