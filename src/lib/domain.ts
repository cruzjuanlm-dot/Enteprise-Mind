export const TENANT_ROLES = ["admin", "reviewer", "approver", "member"] as const;
export type TenantRole = (typeof TENANT_ROLES)[number];

export const JOB_STATUSES = [
  "received",
  "stored",
  "extracting",
  "ready_for_review",
  "awaiting_approval",
  "executing",
  "rolled_back",
  "failed",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_KINDS = ["ingest", "extraction", "execution"] as const;
export type JobKind = (typeof JOB_KINDS)[number];

export const UNIT_TYPES = [
  "architecture",
  "design_decision",
  "pending_task",
  "risk",
  "open_question",
  "glossary_term",
] as const;
export type UnitType = (typeof UNIT_TYPES)[number];

export const REVIEW_STATES = ["proposed", "accepted", "edited", "rejected", "merged"] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];

export const FILING_KINDS = ["unassigned", "project", "cross_functional", "non_project"] as const;
export type FilingKind = (typeof FILING_KINDS)[number];

export type FieldPresence = "known" | "unknown";

export type Tenant = {
  id: string;
  name: string;
  slug: string;
};

export type Department = {
  id: string;
  tenantId: string;
  name: string;
};

export type Project = {
  id: string;
  tenantId: string;
  departmentId: string;
  name: string;
};

export type ProjectGrant = {
  tenantId: string;
  projectId: string;
  userId: string;
  canReadTranscripts: boolean;
};

export type Membership = {
  tenantId: string;
  role: TenantRole;
  projects: { projectId: string; canReadTranscripts: boolean }[];
};

export type Actor = {
  userId: string;
  email: string;
  memberships: Membership[];
};

export type Transcript = {
  id: string;
  tenantId: string;
  projectId: string | null;
  departmentId: string | null;
  filingKind: FilingKind;
  sourceSystem: string;
  sourceExternalId: string | null;
  title: string | null;
  language: string | null;
  capturedAt: string | null;
  normalizedText: string;
  payloadStoragePath: string;
  payloadContentType: string;
  status: "stored" | "quarantined";
  quarantineReason: string | null;
  createdBy: string | null;
  createdAt: string;
  speakers: string[];
};

export type Job = {
  id: string;
  tenantId: string;
  kind: JobKind;
  status: JobStatus;
  transcriptId: string | null;
  transcriptTitle: string | null;
  failureReason: string | null;
  attemptCount: number;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeUnit = {
  id: string;
  tenantId: string;
  projectId: string | null;
  transcriptId: string;
  extractionJobId: string | null;
  unitType: UnitType;
  title: string;
  body: string;
  reviewState: ReviewState;
  proposedTitle: string;
  proposedBody: string;
  sourceExcerpt: string | null;
  ownerName: string | null;
  ownerPresence: FieldPresence;
  dependencies: string[];
  dependenciesPresence: FieldPresence;
  systemsTouched: string[];
  systemsPresence: FieldPresence;
  acceptanceCriteria: string | null;
  acceptancePresence: FieldPresence;
  dueDate: string | null;
  duePresence: FieldPresence;
  approvalRequired: boolean | null;
  approvalPresence: FieldPresence;
  extractedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UnitListItem = KnowledgeUnit & {
  transcriptTitle: string | null;
};

export type DraftUnit = {
  unitType: UnitType;
  title: string;
  body: string;
  sourceExcerpt: string;
  ownerName: string | null;
  ownerPresence: FieldPresence;
  dependencies: string[];
  dependenciesPresence: FieldPresence;
  systemsTouched: string[];
  systemsPresence: FieldPresence;
  acceptanceCriteria: string | null;
  acceptancePresence: FieldPresence;
  dueDate: string | null;
  duePresence: FieldPresence;
  approvalRequired: boolean | null;
  approvalPresence: FieldPresence;
};

export class AppError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
    this.name = "AppError";
  }
}

export function roleIn(actor: Actor, tenantId: string): TenantRole | null {
  return actor.memberships.find((membership) => membership.tenantId === tenantId)?.role ?? null;
}

export function executionFieldsReady(unit: Pick<
  KnowledgeUnit,
  | "unitType"
  | "ownerPresence"
  | "dependenciesPresence"
  | "systemsPresence"
  | "acceptancePresence"
  | "duePresence"
  | "approvalPresence"
>): boolean {
  if (unit.unitType !== "design_decision" && unit.unitType !== "pending_task") return false;
  return (
    unit.ownerPresence === "known" &&
    unit.dependenciesPresence === "known" &&
    unit.systemsPresence === "known" &&
    unit.acceptancePresence === "known" &&
    unit.duePresence === "known" &&
    unit.approvalPresence === "known"
  );
}
