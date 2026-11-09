import type {
  Actor,
  Department,
  DraftUnit,
  FilingKind,
  Job,
  JobKind,
  JobStatus,
  KnowledgeUnit,
  Project,
  ReviewState,
  Tenant,
  Transcript,
  UnitListItem,
} from "./domain";

export type JobEvent = {
  id: string;
  tenantId: string;
  jobId: string;
  status: JobStatus;
  detail: string | null;
  createdAt: string;
};

export type NewTranscript = {
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
  createdBy: string;
  speakers: string[];
  relatedProjectIds: string[];
};

export type NewJob = {
  id: string;
  tenantId: string;
  kind: JobKind;
  status: JobStatus;
  transcriptId: string | null;
};

export type NewUnit = DraftUnit & {
  tenantId: string;
  projectId: string | null;
  transcriptId: string;
  extractionJobId: string;
};

export interface Repository {
  actorFor(userId: string): Promise<Actor | null>;
  getTenant(tenantId: string): Promise<Tenant | null>;
  getTenantBySlug(slug: string): Promise<Tenant | null>;
  getProject(projectId: string): Promise<Project | null>;
  getDepartment(departmentId: string): Promise<Department | null>;

  findTranscriptBySource(
    tenantId: string,
    sourceSystem: string,
    sourceExternalId: string,
  ): Promise<Transcript | null>;
  latestJobForTranscript(transcriptId: string): Promise<Job | null>;
  savePayload(path: string, body: string, contentType: string): Promise<void>;
  insertTranscript(row: NewTranscript): Promise<Transcript>;
  insertJob(row: NewJob): Promise<Job>;
  attachTranscript(jobId: string, transcriptId: string): Promise<void>;
  setJobStatus(jobId: string, status: JobStatus, detail?: string | null): Promise<Job>;
  claimJob(jobId: string, from: JobStatus[], to: JobStatus): Promise<Job | null>;
  getJob(jobId: string): Promise<Job | null>;
  getTranscript(transcriptId: string): Promise<Transcript | null>;
  listUnitsForTranscript(transcriptId: string): Promise<KnowledgeUnit[]>;
  listUnitsForProject(projectId: string): Promise<KnowledgeUnit[]>;
  insertUnits(units: NewUnit[]): Promise<KnowledgeUnit[]>;
  deleteProposedUnitsForJob(jobId: string): Promise<void>;

  listDepartments(actor: Actor): Promise<Department[]>;
  listProjects(actor: Actor): Promise<Project[]>;
  visibleProject(actor: Actor, projectId: string): Promise<Project | null>;
  listJobs(actor: Actor): Promise<Job[]>;
  listJobEvents(actor: Actor, jobId: string): Promise<JobEvent[]>;
  listUnits(actor: Actor, reviewState: ReviewState): Promise<UnitListItem[]>;
  listProjectUnits(actor: Actor, projectId: string): Promise<UnitListItem[]>;
  reviewUnit(actor: Actor, unitId: string, action: "accept" | "reject"): Promise<KnowledgeUnit>;
}
