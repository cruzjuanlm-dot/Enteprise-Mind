import { canIngest, canManageJobs, canReadProject, canSeeJobs } from "./authz";
import { AppError, type Actor, type FilingKind, type Job, type KnowledgeUnit } from "./domain";
import { PAYLOAD_LIMIT } from "./env";
import { extractUnits } from "./extract";
import { detectFormat, normalizeTranscript } from "./normalize";
import type { Repository } from "./repository";

export type IngestInput = {
  tenantSlug?: string;
  sourceSystem?: string;
  sourceExternalId?: string | null;
  title?: string | null;
  projectId?: string | null;
  departmentId?: string | null;
  filingKind?: FilingKind;
  relatedProjectIds?: string[];
  language?: string | null;
  capturedAt?: string | null;
  format?: string;
  content: unknown;
  rerun?: boolean;
};

export type IngestResult = {
  status: number;
  enqueueJobId?: string;
  body: {
    error?: string;
    transcriptId?: string;
    jobId?: string;
    jobStatus?: string;
    idempotent?: boolean;
  };
};

const FAILURE_REASONS = new Set([
  "model_misconfigured",
  "model_request_failed",
  "missing_transcript",
  "not_stored",
  "extraction_failed",
]);

export async function ingest(repo: Repository, actor: Actor, input: IngestInput): Promise<IngestResult> {
  const tenant = await resolveTenant(repo, actor, input.tenantSlug);
  const sourceSystem = cleanToken(input.sourceSystem || "upload", 64);
  if (!sourceSystem) throw new AppError("invalid_source", 400);
  const sourceExternalId = cleanOptional(input.sourceExternalId, 200);
  const title = cleanOptional(input.title, 200);
  const language = cleanOptional(input.language, 16);
  const capturedAt = parseCapturedAt(input.capturedAt);

  if (sourceExternalId) {
    const existing = await repo.findTranscriptBySource(tenant.id, sourceSystem, sourceExternalId);
    if (existing) return rerunOrReturn(repo, existing.id, input.rerun === true);
  }

  const raw = typeof input.content === "string" ? input.content : JSON.stringify(input.content ?? "");
  if (raw.length > PAYLOAD_LIMIT) {
    const job = await repo.insertJob({
      id: crypto.randomUUID(),
      tenantId: tenant.id,
      kind: "extraction",
      status: "received",
      transcriptId: null,
    });
    const failed = await repo.setJobStatus(job.id, "failed", "too_large");
    return { status: 413, body: { error: "too_large", jobId: failed.id, jobStatus: failed.status } };
  }

  const format = input.format || detectFormat(input.content);
  const normalized = normalizeTranscript(format, input.content);
  const filing = await resolveFiling(repo, actor, tenant.id, input);
  const transcriptId = crypto.randomUUID();
  const path = `transcript-payloads/${tenant.id}/${transcriptId}.txt`;
  const contentType = format === "json" ? "application/json" : "text/plain";

  if (!normalized.ok) {
    await repo.savePayload(path, raw, contentType);
    await repo.insertTranscript({
      id: transcriptId,
      tenantId: tenant.id,
      projectId: filing.projectId,
      departmentId: filing.departmentId,
      filingKind: filing.filingKind,
      sourceSystem,
      sourceExternalId,
      title,
      language,
      capturedAt,
      normalizedText: "",
      payloadStoragePath: path,
      payloadContentType: contentType,
      status: "quarantined",
      quarantineReason: normalized.reason,
      createdBy: actor.userId,
      speakers: [],
      relatedProjectIds: filing.relatedProjectIds,
    });
    const job = await repo.insertJob({
      id: crypto.randomUUID(),
      tenantId: tenant.id,
      kind: "extraction",
      status: "received",
      transcriptId,
    });
    await repo.attachTranscript(job.id, transcriptId);
    const failed = await repo.setJobStatus(job.id, "failed", normalized.reason);
    return {
      status: 422,
      body: { error: normalized.reason, transcriptId, jobId: failed.id, jobStatus: failed.status },
    };
  }

  try {
    await repo.savePayload(path, raw, contentType);
    await repo.insertTranscript({
      id: transcriptId,
      tenantId: tenant.id,
      projectId: filing.projectId,
      departmentId: filing.departmentId,
      filingKind: filing.filingKind,
      sourceSystem,
      sourceExternalId,
      title,
      language,
      capturedAt,
      normalizedText: normalized.text,
      payloadStoragePath: path,
      payloadContentType: contentType,
      status: "stored",
      quarantineReason: null,
      createdBy: actor.userId,
      speakers: normalized.speakers,
      relatedProjectIds: filing.relatedProjectIds,
    });
  } catch (error) {
    if (error instanceof AppError && error.code === "duplicate_source" && sourceExternalId) {
      const existing = await repo.findTranscriptBySource(tenant.id, sourceSystem, sourceExternalId);
      if (existing) return rerunOrReturn(repo, existing.id, false);
    }
    throw error;
  }

  const job = await repo.insertJob({
    id: crypto.randomUUID(),
    tenantId: tenant.id,
    kind: "extraction",
    status: "received",
    transcriptId,
  });
  await repo.attachTranscript(job.id, transcriptId);
  const stored = await repo.setJobStatus(job.id, "stored");
  return {
    status: 202,
    enqueueJobId: stored.id,
    body: { transcriptId, jobId: stored.id, jobStatus: stored.status, idempotent: false },
  };
}

export async function runExtraction(repo: Repository, jobId: string): Promise<void> {
  const existing = await repo.getJob(jobId);
  if (!existing) return;
  if (existing.transcriptId) {
    const transcript = await repo.getTranscript(existing.transcriptId);
    if (!transcript || transcript.status !== "stored") return;
  }
  const claimed = await repo.claimJob(jobId, ["stored", "failed"], "extracting");
  if (!claimed) return;
  try {
    if (!claimed.transcriptId) throw new Error("missing_transcript");
    const transcript = await repo.getTranscript(claimed.transcriptId);
    if (!transcript || transcript.status !== "stored") throw new Error("not_stored");
    const drafts = await extractUnits(transcript.normalizedText);
    await repo.deleteProposedUnitsForJob(jobId);
    const remaining = [
      ...(await repo.listUnitsForTranscript(transcript.id)),
      ...(transcript.projectId ? await repo.listUnitsForProject(transcript.projectId) : []),
    ];
    const seen = new Set(remaining.map(unitKey));
    const fresh = drafts.filter((draft) => {
      const key = `${draft.unitType}:${draft.title.trim().toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (fresh.length > 0) {
      await repo.insertUnits(
        fresh.map((draft) => ({
          ...draft,
          tenantId: transcript.tenantId,
          projectId: transcript.projectId,
          transcriptId: transcript.id,
          extractionJobId: jobId,
        })),
      );
    }
    await repo.setJobStatus(jobId, "ready_for_review");
    console.info(JSON.stringify({ event: "job_status", jobId, status: "ready_for_review", units: fresh.length }));
  } catch (error) {
    const reason = failureReason(error);
    console.error(JSON.stringify({ event: "job_status", jobId, status: "failed", reason }));
    await repo.setJobStatus(jobId, "failed", reason);
  }
}

export async function retryExtraction(repo: Repository, actor: Actor, jobId: string): Promise<Job> {
  const job = await repo.getJob(jobId);
  if (!job || !canSeeJobs(actor, job.tenantId)) throw new AppError("not_found", 404);
  if (!canManageJobs(actor, job.tenantId)) throw new AppError("forbidden", 403);
  if (job.status !== "failed") throw new AppError("not_failed", 409);
  if (!job.transcriptId) throw new AppError("not_stored", 409);
  const transcript = await repo.getTranscript(job.transcriptId);
  if (!transcript || transcript.status !== "stored") throw new AppError("not_stored", 409);
  return job;
}

async function resolveTenant(repo: Repository, actor: Actor, slug: string | undefined) {
  const allowed = actor.memberships.filter((membership) => canIngest(actor, membership.tenantId));
  if (allowed.length === 0) throw new AppError("not_a_member", 403);
  if (slug?.trim()) {
    const tenant = await repo.getTenantBySlug(slug.trim());
    if (!tenant || !canIngest(actor, tenant.id)) throw new AppError("not_a_member", 403);
    return tenant;
  }
  if (allowed.length !== 1) throw new AppError("tenant_required", 400);
  const tenant = await repo.getTenant(allowed[0].tenantId);
  if (!tenant) throw new AppError("not_a_member", 403);
  return tenant;
}

async function resolveFiling(repo: Repository, actor: Actor, tenantId: string, input: IngestInput) {
  const projectId = cleanOptional(input.projectId, 80);
  const departmentId = cleanOptional(input.departmentId, 80);
  const related = [...new Set((input.relatedProjectIds ?? []).map((id) => id.trim()).filter(Boolean))];
  let project = null;
  if (projectId) {
    project = await repo.getProject(projectId);
    if (!project || project.tenantId !== tenantId) throw new AppError("unknown_project", 400);
    if (!canReadProject(actor, project)) throw new AppError("forbidden", 403);
  }
  let department = null;
  if (departmentId) {
    department = await repo.getDepartment(departmentId);
    if (!department || department.tenantId !== tenantId) throw new AppError("unknown_department", 400);
  }
  const filingKind: FilingKind = input.filingKind ?? (project ? "project" : "unassigned");
  if (filingKind === "project" || filingKind === "cross_functional") {
    if (!project) throw new AppError("invalid_filing", 400);
  }
  if (filingKind === "unassigned" && project) throw new AppError("invalid_filing", 400);
  if (filingKind === "non_project" && (project || !department)) throw new AppError("invalid_filing", 400);
  for (const relatedId of related) {
    const relatedProject = await repo.getProject(relatedId);
    if (!relatedProject || relatedProject.tenantId !== tenantId) throw new AppError("unknown_project", 400);
    if (!canReadProject(actor, relatedProject)) throw new AppError("forbidden", 403);
  }
  return {
    filingKind,
    projectId: project?.id ?? null,
    departmentId: project?.departmentId ?? department?.id ?? null,
    relatedProjectIds: related.filter((id) => id !== project?.id),
  };
}

async function rerunOrReturn(repo: Repository, transcriptId: string, rerun: boolean): Promise<IngestResult> {
  const job = await repo.latestJobForTranscript(transcriptId);
  if (!job) throw new AppError("missing_job", 409);
  if (!rerun || job.status === "received" || job.status === "stored" || job.status === "extracting") {
    return {
      status: 200,
      body: { transcriptId, jobId: job.id, jobStatus: job.status, idempotent: true },
    };
  }
  if (job.status !== "ready_for_review" && job.status !== "failed") {
    throw new AppError("not_rerunnable", 409);
  }
  const stored = await repo.setJobStatus(job.id, "stored");
  return {
    status: 202,
    enqueueJobId: stored.id,
    body: { transcriptId, jobId: stored.id, jobStatus: "stored", idempotent: false },
  };
}

function parseCapturedAt(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new AppError("invalid_captured_at", 400);
  return parsed.toISOString();
}

function cleanToken(value: string, max: number): string {
  const trimmed = value.trim().toLowerCase();
  if (!/^[a-z0-9_-]+$/.test(trimmed) || trimmed.length > max) return "";
  return trimmed;
}

function cleanOptional(value: string | null | undefined, max: number): string | null {
  if (!value?.trim()) return null;
  return value.trim().slice(0, max);
}

function unitKey(unit: Pick<KnowledgeUnit, "unitType" | "title">): string {
  return `${unit.unitType}:${unit.title.trim().toLowerCase()}`;
}

function failureReason(error: unknown): string {
  if (error instanceof Error && FAILURE_REASONS.has(error.message)) return error.message;
  if (error instanceof AppError && FAILURE_REASONS.has(error.code)) return error.code;
  return "extraction_failed";
}
