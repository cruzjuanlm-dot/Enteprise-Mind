import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, type Actor, type Department, type Job, type JobStatus, type KnowledgeUnit, type Membership, type Project, type Tenant, type Transcript, type UnitListItem } from "./domain";
import { canReadProject, canReadUnit, canReviewUnit, canSeeJobs } from "./authz";
import type { JobEvent, NewJob, NewTranscript, NewUnit, Repository } from "./repository";

type Row = Record<string, unknown>;

export class SupabaseRepository implements Repository {
  constructor(
    private readonly service: SupabaseClient,
    private readonly user: SupabaseClient | null,
  ) {}

  async actorFor(userId: string): Promise<Actor | null> {
    const client = this.user;
    if (!client) return null;
    const memberships = await unwrap(
      client.from("tenant_memberships").select("tenant_id, role").eq("user_id", userId),
    );
    const grants = await unwrap(
      client.from("project_memberships").select("tenant_id, project_id, can_read_transcripts").eq("user_id", userId),
    );
    const grouped: Membership[] = memberships.map((row) => ({
      tenantId: text(row, "tenant_id"),
      role: text(row, "role") as Membership["role"],
      projects: grants
        .filter((grant) => text(grant, "tenant_id") === text(row, "tenant_id"))
        .map((grant) => ({
          projectId: text(grant, "project_id"),
          canReadTranscripts: grant.can_read_transcripts === true,
        })),
    }));
    return { userId, email: "", memberships: grouped };
  }

  async getTenant(tenantId: string): Promise<Tenant | null> {
    const rows = await unwrap(this.service.from("tenants").select("id, name, slug").eq("id", tenantId).limit(1));
    return rows[0] ? { id: text(rows[0], "id"), name: text(rows[0], "name"), slug: text(rows[0], "slug") } : null;
  }

  async getTenantBySlug(slug: string): Promise<Tenant | null> {
    const rows = await unwrap(this.service.from("tenants").select("id, name, slug").eq("slug", slug).limit(1));
    return rows[0] ? { id: text(rows[0], "id"), name: text(rows[0], "name"), slug: text(rows[0], "slug") } : null;
  }

  async getProject(projectId: string): Promise<Project | null> {
    const rows = await unwrap(this.service.from("projects").select("id, tenant_id, department_id, name").eq("id", projectId).limit(1));
    return rows[0] ? mapProject(rows[0]) : null;
  }

  async getDepartment(departmentId: string): Promise<Department | null> {
    const rows = await unwrap(
      this.service.from("departments").select("id, tenant_id, name").eq("id", departmentId).limit(1),
    );
    return rows[0] ? mapDepartment(rows[0]) : null;
  }

  async findTranscriptBySource(tenantId: string, sourceSystem: string, sourceExternalId: string) {
    const rows = await unwrap(
      this.service
        .from("transcripts")
        .select(TRANSCRIPT_COLUMNS)
        .eq("tenant_id", tenantId)
        .eq("source_system", sourceSystem)
        .eq("source_external_id", sourceExternalId)
        .limit(1),
    );
    if (!rows[0]) return null;
    return this.hydrateTranscript(rows[0]);
  }

  async latestJobForTranscript(transcriptId: string): Promise<Job | null> {
    const rows = await unwrap(
      this.service.from("jobs").select(JOB_COLUMNS).eq("transcript_id", transcriptId).order("created_at", { ascending: false }).limit(1),
    );
    return rows[0] ? mapJob(rows[0], null) : null;
  }

  async savePayload(path: string, body: string, contentType: string): Promise<void> {
    const key = path.replace(/^transcript-payloads\//, "");
    const { error } = await this.service.storage.from("transcript-payloads").upload(key, body, {
      contentType,
      upsert: false,
    });
    if (error) throw new AppError("storage_failed", 502);
  }

  async insertTranscript(row: NewTranscript): Promise<Transcript> {
    const { data, error } = await this.service
      .from("transcripts")
      .insert({
        id: row.id,
        tenant_id: row.tenantId,
        project_id: row.projectId,
        department_id: row.departmentId,
        filing_kind: row.filingKind,
        source_system: row.sourceSystem,
        source_external_id: row.sourceExternalId,
        title: row.title,
        language: row.language,
        captured_at: row.capturedAt,
        normalized_text: row.normalizedText,
        payload_storage_path: row.payloadStoragePath,
        payload_content_type: row.payloadContentType,
        status: row.status,
        quarantine_reason: row.quarantineReason,
        created_by: row.createdBy,
      })
      .select(TRANSCRIPT_COLUMNS)
      .single();
    if (error) {
      if (error.code === "23505") throw new AppError("duplicate_source", 409);
      throw new AppError("store_failed", 500);
    }
    if (row.speakers.length > 0) {
      const { error: speakerError } = await this.service.from("transcript_speakers").insert(
        row.speakers.map((label) => ({ tenant_id: row.tenantId, transcript_id: row.id, label })),
      );
      if (speakerError) throw new AppError("store_failed", 500);
    }
    if (row.relatedProjectIds.length > 0) {
      const { error: relatedError } = await this.service.from("transcript_related_projects").insert(
        row.relatedProjectIds.map((projectId) => ({
          tenant_id: row.tenantId,
          transcript_id: row.id,
          project_id: projectId,
        })),
      );
      if (relatedError) throw new AppError("store_failed", 500);
    }
    return { ...(await this.hydrateTranscript(data as Row)), speakers: row.speakers };
  }

  async insertJob(row: NewJob): Promise<Job> {
    const { data, error } = await this.service
      .from("jobs")
      .insert({
        id: row.id,
        tenant_id: row.tenantId,
        kind: row.kind,
        status: row.status,
        transcript_id: row.transcriptId,
        attempt_count: 0,
      })
      .select(JOB_COLUMNS)
      .single();
    if (error || !data) throw new AppError("store_failed", 500);
    await this.insertEvent(row.tenantId, row.id, row.status, null);
    return mapJob(data as Row, null);
  }

  async attachTranscript(jobId: string, transcriptId: string): Promise<void> {
    const { error } = await this.service.from("jobs").update({ transcript_id: transcriptId }).eq("id", jobId);
    if (error) throw new AppError("store_failed", 500);
  }

  async setJobStatus(jobId: string, status: JobStatus, detail?: string | null): Promise<Job> {
    const existing = await this.getJob(jobId);
    if (!existing) throw new AppError("not_found", 404);
    const failure = status === "failed" ? detail ?? "failed" : null;
    const { data, error } = await this.service
      .from("jobs")
      .update({ status, failure_reason: failure })
      .eq("id", jobId)
      .select(JOB_COLUMNS)
      .single();
    if (error || !data) throw new AppError("store_failed", 500);
    await this.insertEvent(existing.tenantId, jobId, status, failure);
    return mapJob(data as Row, existing.transcriptTitle);
  }

  async claimJob(jobId: string, from: JobStatus[], to: JobStatus): Promise<Job | null> {
    const existing = await this.getJob(jobId);
    if (!existing || !from.includes(existing.status)) return null;
    const attemptCount = existing.status === "failed" ? existing.attemptCount + 1 : existing.attemptCount;
    const { data, error } = await this.service
      .from("jobs")
      .update({ status: to, failure_reason: null, attempt_count: attemptCount })
      .eq("id", jobId)
      .eq("status", existing.status)
      .select(JOB_COLUMNS)
      .maybeSingle();
    if (error) throw new AppError("store_failed", 500);
    if (!data) return null;
    await this.insertEvent(existing.tenantId, jobId, to, null);
    return mapJob(data as Row, existing.transcriptTitle);
  }

  async getJob(jobId: string): Promise<Job | null> {
    const rows = await unwrap(this.service.from("jobs").select(JOB_COLUMNS).eq("id", jobId).limit(1));
    if (!rows[0]) return null;
    const title = await this.serviceTitle(rows[0].transcript_id);
    return mapJob(rows[0], title);
  }

  async getTranscript(transcriptId: string): Promise<Transcript | null> {
    const rows = await unwrap(this.service.from("transcripts").select(TRANSCRIPT_COLUMNS).eq("id", transcriptId).limit(1));
    return rows[0] ? this.hydrateTranscript(rows[0]) : null;
  }

  async listUnitsForTranscript(transcriptId: string): Promise<KnowledgeUnit[]> {
    const rows = await unwrap(
      this.service.from("knowledge_units").select(UNIT_COLUMNS).eq("transcript_id", transcriptId),
    );
    return rows.map(mapUnit);
  }

  async listUnitsForProject(projectId: string): Promise<KnowledgeUnit[]> {
    const rows = await unwrap(this.service.from("knowledge_units").select(UNIT_COLUMNS).eq("project_id", projectId));
    return rows.map(mapUnit);
  }

  async insertUnits(units: NewUnit[]): Promise<KnowledgeUnit[]> {
    if (units.length === 0) return [];
    const { data, error } = await this.service
      .from("knowledge_units")
      .insert(units.map(unitInsert))
      .select(UNIT_COLUMNS);
    if (error || !data) throw new AppError("store_failed", 500);
    return (data as Row[]).map(mapUnit);
  }

  async deleteProposedUnitsForJob(jobId: string): Promise<void> {
    const { error } = await this.service
      .from("knowledge_units")
      .delete()
      .eq("extraction_job_id", jobId)
      .eq("review_state", "proposed");
    if (error) throw new AppError("store_failed", 500);
  }

  async listDepartments(actor: Actor): Promise<Department[]> {
    const client = this.requireUser();
    const rows = await unwrap(client.from("departments").select("id, tenant_id, name").order("name"));
    return rows.map(mapDepartment).filter((department) => actor.memberships.some((item) => item.tenantId === department.tenantId));
  }

  async listProjects(actor: Actor): Promise<Project[]> {
    const client = this.requireUser();
    const rows = await unwrap(client.from("projects").select("id, tenant_id, department_id, name").order("name"));
    return rows.map(mapProject).filter((project) => canReadProject(actor, project));
  }

  async visibleProject(actor: Actor, projectId: string): Promise<Project | null> {
    const projects = await this.listProjects(actor);
    return projects.find((project) => project.id === projectId) ?? null;
  }

  async listJobs(actor: Actor): Promise<Job[]> {
    const client = this.requireUser();
    const rows = await unwrap(client.from("jobs").select(JOB_COLUMNS).order("created_at", { ascending: false }));
    const visible = rows.filter((row) => canSeeJobs(actor, text(row, "tenant_id")));
    const titles = await this.visibleTitles(
      client,
      visible.map((row) => row.transcript_id).filter((id): id is string => typeof id === "string"),
    );
    return visible.map((row) => mapJob(row, titles.get(String(row.transcript_id)) ?? null));
  }

  async listJobEvents(actor: Actor, jobId: string): Promise<JobEvent[]> {
    const job = (await this.listJobs(actor)).find((item) => item.id === jobId);
    if (!job) return [];
    const client = this.requireUser();
    const rows = await unwrap(client.from("job_events").select("id, tenant_id, job_id, status, detail, created_at").eq("job_id", jobId).order("created_at"));
    return rows.map((row) => ({
      id: text(row, "id"),
      tenantId: text(row, "tenant_id"),
      jobId: text(row, "job_id"),
      status: text(row, "status") as JobStatus,
      detail: nullableText(row, "detail"),
      createdAt: text(row, "created_at"),
    }));
  }

  async listUnits(actor: Actor, reviewState: KnowledgeUnit["reviewState"]): Promise<UnitListItem[]> {
    const client = this.requireUser();
    const rows = await unwrap(
      client.from("knowledge_units").select(UNIT_COLUMNS).eq("review_state", reviewState).order("created_at"),
    );
    return this.decorateUnits(client, rows.map(mapUnit).filter((unit) => canReadUnit(actor, unit)));
  }

  async listProjectUnits(actor: Actor, projectId: string): Promise<UnitListItem[]> {
    if (!(await this.visibleProject(actor, projectId))) return [];
    const client = this.requireUser();
    const rows = await unwrap(
      client
        .from("knowledge_units")
        .select(UNIT_COLUMNS)
        .eq("project_id", projectId)
        .in("review_state", ["accepted", "edited", "merged"])
        .order("created_at"),
    );
    return this.decorateUnits(client, rows.map(mapUnit).filter((unit) => canReadUnit(actor, unit)));
  }

  async reviewUnit(actor: Actor, unitId: string, action: "accept" | "reject"): Promise<KnowledgeUnit> {
    const client = this.requireUser();
    const existingRows = await unwrap(client.from("knowledge_units").select(UNIT_COLUMNS).eq("id", unitId).limit(1));
    const existing = existingRows[0] ? mapUnit(existingRows[0]) : null;
    if (!existing || !canReadUnit(actor, existing)) throw new AppError("not_found", 404);
    if (!canReviewUnit(actor, existing)) {
      throw new AppError(existing.reviewState === "proposed" ? "forbidden" : "not_proposed", existing.reviewState === "proposed" ? 403 : 409);
    }
    const { data, error } = await client.rpc("review_unit", { unit_id: unitId, action });
    if (error) {
      if (error.code === "42501" || error.message.includes("review_rejected")) throw new AppError("forbidden", 403);
      if (error.code === "22023" || error.message.includes("invalid_action")) throw new AppError("invalid_action", 400);
      throw new AppError("review_failed", 500);
    }
    const row = (Array.isArray(data) ? data[0] : data) as Row | null;
    if (!row) throw new AppError("forbidden", 403);
    return mapUnit(row);
  }

  private requireUser(): SupabaseClient {
    if (!this.user) throw new AppError("unauthorized", 401);
    return this.user;
  }

  private async hydrateTranscript(row: Row): Promise<Transcript> {
    const speakers = await unwrap(
      this.service.from("transcript_speakers").select("label").eq("transcript_id", text(row, "id")),
    );
    return mapTranscript(row, speakers.map((speaker) => text(speaker, "label")));
  }

  private async serviceTitle(transcriptId: unknown): Promise<string | null> {
    if (typeof transcriptId !== "string") return null;
    const rows = await unwrap(this.service.from("transcripts").select("title").eq("id", transcriptId).limit(1));
    return rows[0] ? nullableText(rows[0], "title") : null;
  }

  private async visibleTitles(client: SupabaseClient, ids: string[]): Promise<Map<string, string | null>> {
    const titles = new Map<string, string | null>();
    if (ids.length === 0) return titles;
    const rows = await unwrap(client.from("transcripts").select("id, title").in("id", ids));
    for (const row of rows) titles.set(text(row, "id"), nullableText(row, "title"));
    return titles;
  }

  private async decorateUnits(client: SupabaseClient, units: KnowledgeUnit[]): Promise<UnitListItem[]> {
    const titles = await this.visibleTitles(
      client,
      units.map((unit) => unit.transcriptId),
    );
    return units.map((unit) => ({
      ...unit,
      transcriptTitle: titles.get(unit.transcriptId) ?? null,
    }));
  }

  private async insertEvent(tenantId: string, jobId: string, status: JobStatus, detail: string | null) {
    const { error } = await this.service.from("job_events").insert({
      tenant_id: tenantId,
      job_id: jobId,
      status,
      detail,
    });
    if (error) throw new AppError("store_failed", 500);
  }
}

const TRANSCRIPT_COLUMNS =
  "id, tenant_id, project_id, department_id, filing_kind, source_system, source_external_id, title, language, captured_at, normalized_text, payload_storage_path, payload_content_type, status, quarantine_reason, created_by, created_at";
const JOB_COLUMNS =
  "id, tenant_id, kind, status, transcript_id, failure_reason, attempt_count, created_at, updated_at";
const UNIT_COLUMNS =
  "id, tenant_id, project_id, transcript_id, extraction_job_id, unit_type, title, body, review_state, proposed_title, proposed_body, source_excerpt, owner_name, owner_presence, dependencies, dependencies_presence, systems_touched, systems_presence, acceptance_criteria, acceptance_presence, due_date, due_presence, approval_required, approval_presence, extracted_at, reviewed_by, reviewed_at, created_at, updated_at";

function unitInsert(unit: NewUnit) {
  return {
    tenant_id: unit.tenantId,
    project_id: unit.projectId,
    transcript_id: unit.transcriptId,
    extraction_job_id: unit.extractionJobId,
    unit_type: unit.unitType,
    title: unit.title,
    body: unit.body,
    review_state: "proposed",
    proposed_title: unit.title,
    proposed_body: unit.body,
    source_excerpt: unit.sourceExcerpt,
    owner_name: unit.ownerName,
    owner_presence: unit.ownerPresence,
    dependencies: unit.dependencies,
    dependencies_presence: unit.dependenciesPresence,
    systems_touched: unit.systemsTouched,
    systems_presence: unit.systemsPresence,
    acceptance_criteria: unit.acceptanceCriteria,
    acceptance_presence: unit.acceptancePresence,
    due_date: unit.dueDate,
    due_presence: unit.duePresence,
    approval_required: unit.approvalRequired,
    approval_presence: unit.approvalPresence,
  };
}

async function unwrap(query: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<Row[]> {
  const { data, error } = await query;
  if (error) throw new AppError("store_failed", 500);
  if (!data) return [];
  return Array.isArray(data) ? (data as Row[]) : [data as Row];
}

function mapProject(row: Row): Project {
  return {
    id: text(row, "id"),
    tenantId: text(row, "tenant_id"),
    departmentId: text(row, "department_id"),
    name: text(row, "name"),
  };
}

function mapDepartment(row: Row): Department {
  return { id: text(row, "id"), tenantId: text(row, "tenant_id"), name: text(row, "name") };
}

function mapTranscript(row: Row, speakers: string[]): Transcript {
  return {
    id: text(row, "id"),
    tenantId: text(row, "tenant_id"),
    projectId: nullableText(row, "project_id"),
    departmentId: nullableText(row, "department_id"),
    filingKind: text(row, "filing_kind") as Transcript["filingKind"],
    sourceSystem: text(row, "source_system"),
    sourceExternalId: nullableText(row, "source_external_id"),
    title: nullableText(row, "title"),
    language: nullableText(row, "language"),
    capturedAt: nullableText(row, "captured_at"),
    normalizedText: text(row, "normalized_text"),
    payloadStoragePath: text(row, "payload_storage_path"),
    payloadContentType: text(row, "payload_content_type"),
    status: text(row, "status") as Transcript["status"],
    quarantineReason: nullableText(row, "quarantine_reason"),
    createdBy: nullableText(row, "created_by"),
    createdAt: text(row, "created_at"),
    speakers,
  };
}

function mapJob(row: Row, transcriptTitle: string | null): Job {
  return {
    id: text(row, "id"),
    tenantId: text(row, "tenant_id"),
    kind: text(row, "kind") as Job["kind"],
    status: text(row, "status") as JobStatus,
    transcriptId: nullableText(row, "transcript_id"),
    transcriptTitle,
    failureReason: nullableText(row, "failure_reason"),
    attemptCount: numberValue(row, "attempt_count"),
    createdAt: text(row, "created_at"),
    updatedAt: text(row, "updated_at"),
  };
}

function mapUnit(row: Row): KnowledgeUnit {
  return {
    id: text(row, "id"),
    tenantId: text(row, "tenant_id"),
    projectId: nullableText(row, "project_id"),
    transcriptId: text(row, "transcript_id"),
    extractionJobId: nullableText(row, "extraction_job_id"),
    unitType: text(row, "unit_type") as KnowledgeUnit["unitType"],
    title: text(row, "title"),
    body: text(row, "body"),
    reviewState: text(row, "review_state") as KnowledgeUnit["reviewState"],
    proposedTitle: text(row, "proposed_title"),
    proposedBody: text(row, "proposed_body"),
    sourceExcerpt: nullableText(row, "source_excerpt"),
    ownerName: nullableText(row, "owner_name"),
    ownerPresence: text(row, "owner_presence") as KnowledgeUnit["ownerPresence"],
    dependencies: stringList(row.dependencies),
    dependenciesPresence: text(row, "dependencies_presence") as KnowledgeUnit["dependenciesPresence"],
    systemsTouched: stringList(row.systems_touched),
    systemsPresence: text(row, "systems_presence") as KnowledgeUnit["systemsPresence"],
    acceptanceCriteria: nullableText(row, "acceptance_criteria"),
    acceptancePresence: text(row, "acceptance_presence") as KnowledgeUnit["acceptancePresence"],
    dueDate: nullableText(row, "due_date"),
    duePresence: text(row, "due_presence") as KnowledgeUnit["duePresence"],
    approvalRequired: row.approval_required === null || row.approval_required === undefined ? null : row.approval_required === true,
    approvalPresence: text(row, "approval_presence") as KnowledgeUnit["approvalPresence"],
    extractedAt: text(row, "extracted_at"),
    reviewedBy: nullableText(row, "reviewed_by"),
    reviewedAt: nullableText(row, "reviewed_at"),
    createdAt: text(row, "created_at"),
    updatedAt: text(row, "updated_at"),
  };
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function text(row: Row, key: string): string {
  const value = row[key];
  if (typeof value !== "string") throw new AppError("store_failed", 500);
  return value;
}

function nullableText(row: Row, key: string): string | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new AppError("store_failed", 500);
  return value;
}

function numberValue(row: Row, key: string): number {
  const value = row[key];
  if (typeof value !== "number") throw new AppError("store_failed", 500);
  return value;
}
