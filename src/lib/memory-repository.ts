import { canReadProject, canReadTranscript, canReadUnit, canReviewUnit, canSeeJobs } from "./authz";
import { AppError, type Actor, type Department, type Job, type KnowledgeUnit, type Membership, type Project, type Tenant, type Transcript, type UnitListItem } from "./domain";
import { FIXTURES, LOCAL_ACCOUNTS } from "./fixtures";
import type { JobEvent, NewJob, NewTranscript, NewUnit, Repository } from "./repository";

type State = {
  tenants: Tenant[];
  departments: Department[];
  projects: Project[];
  memberships: { tenantId: string; userId: string; role: Membership["role"] }[];
  grants: { tenantId: string; projectId: string; userId: string; canReadTranscripts: boolean }[];
  users: { id: string; email: string }[];
  transcripts: Transcript[];
  jobs: Job[];
  events: JobEvent[];
  units: KnowledgeUnit[];
  payloads: Map<string, { body: string; contentType: string }>;
};

const globalStore = globalThis as typeof globalThis & {
  __enterpriseMind?: MemoryRepository;
};

export class MemoryRepository implements Repository {
  constructor(private readonly state: State = seedState()) {}

  async actorFor(userId: string): Promise<Actor | null> {
    const user = this.state.users.find((item) => item.id === userId);
    if (!user) return null;
    const memberships = this.state.memberships
      .filter((membership) => membership.userId === userId)
      .map((membership) => ({
        tenantId: membership.tenantId,
        role: membership.role,
        projects: this.state.grants
          .filter((grant) => grant.userId === userId && grant.tenantId === membership.tenantId)
          .map((grant) => ({
            projectId: grant.projectId,
            canReadTranscripts: grant.canReadTranscripts,
          })),
      }));
    return { userId: user.id, email: user.email, memberships };
  }

  async getTenant(tenantId: string): Promise<Tenant | null> {
    return this.state.tenants.find((tenant) => tenant.id === tenantId) ?? null;
  }

  async getTenantBySlug(slug: string): Promise<Tenant | null> {
    return this.state.tenants.find((tenant) => tenant.slug === slug) ?? null;
  }

  async getProject(projectId: string): Promise<Project | null> {
    return this.state.projects.find((project) => project.id === projectId) ?? null;
  }

  async getDepartment(departmentId: string): Promise<Department | null> {
    return this.state.departments.find((department) => department.id === departmentId) ?? null;
  }

  async findTranscriptBySource(tenantId: string, sourceSystem: string, sourceExternalId: string) {
    return (
      this.state.transcripts.find(
        (transcript) =>
          transcript.tenantId === tenantId &&
          transcript.sourceSystem === sourceSystem &&
          transcript.sourceExternalId === sourceExternalId,
      ) ?? null
    );
  }

  async latestJobForTranscript(transcriptId: string): Promise<Job | null> {
    return (
      this.state.jobs
        .filter((job) => job.transcriptId === transcriptId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
    );
  }

  async savePayload(path: string, body: string, contentType: string): Promise<void> {
    this.state.payloads.set(path, { body, contentType });
  }

  async insertTranscript(row: NewTranscript): Promise<Transcript> {
    if (
      row.sourceExternalId &&
      (await this.findTranscriptBySource(row.tenantId, row.sourceSystem, row.sourceExternalId))
    ) {
      throw new AppError("duplicate_source", 409);
    }
    const transcript: Transcript = {
      ...row,
      createdAt: now(),
    };
    this.state.transcripts.push(transcript);
    return transcript;
  }

  async insertJob(row: NewJob): Promise<Job> {
    const job: Job = {
      id: row.id,
      tenantId: row.tenantId,
      kind: row.kind,
      status: row.status,
      transcriptId: row.transcriptId,
      transcriptTitle: this.titleFor(row.transcriptId),
      failureReason: null,
      attemptCount: 0,
      createdAt: now(),
      updatedAt: now(),
    };
    this.state.jobs.push(job);
    this.pushEvent(job, row.status, null);
    return job;
  }

  async attachTranscript(jobId: string, transcriptId: string): Promise<void> {
    const job = this.requireJob(jobId);
    job.transcriptId = transcriptId;
    job.transcriptTitle = this.titleFor(transcriptId);
    job.updatedAt = now();
  }

  async setJobStatus(jobId: string, status: Job["status"], detail?: string | null): Promise<Job> {
    const job = this.requireJob(jobId);
    job.status = status;
    job.failureReason = status === "failed" ? detail ?? "failed" : null;
    job.updatedAt = now();
    this.pushEvent(job, status, status === "failed" ? job.failureReason : null);
    return job;
  }

  async claimJob(jobId: string, from: Job["status"][], to: Job["status"]): Promise<Job | null> {
    const job = this.state.jobs.find((item) => item.id === jobId);
    if (!job || !from.includes(job.status)) return null;
    if (job.status === "failed") job.attemptCount += 1;
    job.status = to;
    job.failureReason = null;
    job.updatedAt = now();
    this.pushEvent(job, to, null);
    return job;
  }

  async getJob(jobId: string): Promise<Job | null> {
    return this.state.jobs.find((job) => job.id === jobId) ?? null;
  }

  async getTranscript(transcriptId: string): Promise<Transcript | null> {
    return this.state.transcripts.find((transcript) => transcript.id === transcriptId) ?? null;
  }

  async listUnitsForTranscript(transcriptId: string): Promise<KnowledgeUnit[]> {
    return this.state.units.filter((unit) => unit.transcriptId === transcriptId);
  }

  async listUnitsForProject(projectId: string): Promise<KnowledgeUnit[]> {
    return this.state.units.filter((unit) => unit.projectId === projectId);
  }

  async insertUnits(units: NewUnit[]): Promise<KnowledgeUnit[]> {
    const created = units.map((unit) => {
      const timestamp = now();
      const row: KnowledgeUnit = {
        id: crypto.randomUUID(),
        tenantId: unit.tenantId,
        projectId: unit.projectId,
        transcriptId: unit.transcriptId,
        extractionJobId: unit.extractionJobId,
        unitType: unit.unitType,
        title: unit.title,
        body: unit.body,
        reviewState: "proposed",
        proposedTitle: unit.title,
        proposedBody: unit.body,
        sourceExcerpt: unit.sourceExcerpt,
        ownerName: unit.ownerName,
        ownerPresence: unit.ownerPresence,
        dependencies: unit.dependencies,
        dependenciesPresence: unit.dependenciesPresence,
        systemsTouched: unit.systemsTouched,
        systemsPresence: unit.systemsPresence,
        acceptanceCriteria: unit.acceptanceCriteria,
        acceptancePresence: unit.acceptancePresence,
        dueDate: unit.dueDate,
        duePresence: unit.duePresence,
        approvalRequired: unit.approvalRequired,
        approvalPresence: unit.approvalPresence,
        extractedAt: timestamp,
        reviewedBy: null,
        reviewedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      this.state.units.push(row);
      return row;
    });
    return created;
  }

  async deleteProposedUnitsForJob(jobId: string): Promise<void> {
    this.state.units = this.state.units.filter(
      (unit) => !(unit.extractionJobId === jobId && unit.reviewState === "proposed"),
    );
  }

  async listDepartments(actor: Actor): Promise<Department[]> {
    const visibleProjects = await this.listProjects(actor);
    const ids = new Set(visibleProjects.map((project) => project.departmentId));
    return this.state.departments.filter((department) => ids.has(department.id));
  }

  async listProjects(actor: Actor): Promise<Project[]> {
    return this.state.projects.filter((project) => canReadProject(actor, project));
  }

  async visibleProject(actor: Actor, projectId: string): Promise<Project | null> {
    const project = await this.getProject(projectId);
    if (!project || !canReadProject(actor, project)) return null;
    return project;
  }

  async listJobs(actor: Actor): Promise<Job[]> {
    return this.state.jobs
      .filter((job) => canSeeJobs(actor, job.tenantId))
      .map((job) => this.redactJob(actor, job))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listJobEvents(actor: Actor, jobId: string): Promise<JobEvent[]> {
    const job = await this.getJob(jobId);
    if (!job || !canSeeJobs(actor, job.tenantId)) return [];
    return this.state.events.filter((event) => event.jobId === jobId);
  }

  async listUnits(actor: Actor, reviewState: KnowledgeUnit["reviewState"]): Promise<UnitListItem[]> {
    return this.state.units
      .filter((unit) => unit.reviewState === reviewState && canReadUnit(actor, unit))
      .map((unit) => this.withTitle(actor, unit));
  }

  async listProjectUnits(actor: Actor, projectId: string): Promise<UnitListItem[]> {
    const project = await this.visibleProject(actor, projectId);
    if (!project) return [];
    return this.state.units
      .filter(
        (unit) =>
          unit.projectId === projectId &&
          (unit.reviewState === "accepted" || unit.reviewState === "edited" || unit.reviewState === "merged") &&
          canReadUnit(actor, unit),
      )
      .map((unit) => this.withTitle(actor, unit));
  }

  async reviewUnit(actor: Actor, unitId: string, action: "accept" | "reject"): Promise<KnowledgeUnit> {
    const unit = this.state.units.find((item) => item.id === unitId);
    if (!unit || !canReadUnit(actor, unit)) throw new AppError("not_found", 404);
    if (!canReviewUnit(actor, unit)) {
      throw new AppError(unit.reviewState === "proposed" ? "forbidden" : "not_proposed", unit.reviewState === "proposed" ? 403 : 409);
    }
    unit.reviewState = action === "accept" ? "accepted" : "rejected";
    unit.reviewedBy = actor.userId;
    unit.reviewedAt = now();
    unit.updatedAt = unit.reviewedAt;
    return unit;
  }

  private requireJob(jobId: string): Job {
    const job = this.state.jobs.find((item) => item.id === jobId);
    if (!job) throw new AppError("not_found", 404);
    return job;
  }

  private titleFor(transcriptId: string | null): string | null {
    if (!transcriptId) return null;
    return this.state.transcripts.find((transcript) => transcript.id === transcriptId)?.title ?? null;
  }

  private redactJob(actor: Actor, job: Job): Job {
    const transcript = job.transcriptId
      ? this.state.transcripts.find((item) => item.id === job.transcriptId)
      : null;
    const title = transcript && canReadTranscript(actor, transcript) ? transcript.title : null;
    return { ...job, transcriptTitle: title };
  }

  private withTitle(actor: Actor, unit: KnowledgeUnit): UnitListItem {
    const transcript = this.state.transcripts.find((item) => item.id === unit.transcriptId);
    return {
      ...unit,
      transcriptTitle: transcript && canReadTranscript(actor, transcript) ? transcript.title : null,
    };
  }

  private pushEvent(job: Job, status: Job["status"], detail: string | null) {
    this.state.events.push({
      id: crypto.randomUUID(),
      tenantId: job.tenantId,
      jobId: job.id,
      status,
      detail,
      createdAt: now(),
    });
  }
}

function now(): string {
  return new Date().toISOString();
}

function seedState(): State {
  const reviewerGrant = {
    tenantId: FIXTURES.pilotTenant,
    projectId: FIXTURES.rolloutProject,
    userId: FIXTURES.reviewer,
    canReadTranscripts: true,
  };
  const memberGrant = {
    tenantId: FIXTURES.pilotTenant,
    projectId: FIXTURES.rolloutProject,
    userId: FIXTURES.member,
    canReadTranscripts: false,
  };
  const outsiderGrant = {
    tenantId: FIXTURES.otherTenant,
    projectId: FIXTURES.otherProject,
    userId: FIXTURES.outsider,
    canReadTranscripts: true,
  };
  return {
    users: LOCAL_ACCOUNTS.map((account) => ({ id: account.id, email: account.email })),
    tenants: [
      { id: FIXTURES.pilotTenant, name: "Pilot", slug: "pilot" },
      { id: FIXTURES.otherTenant, name: "Other", slug: "other" },
    ],
    departments: [
      { id: FIXTURES.deliveryDept, tenantId: FIXTURES.pilotTenant, name: "Delivery" },
      { id: FIXTURES.otherDept, tenantId: FIXTURES.otherTenant, name: "Operations" },
    ],
    projects: [
      {
        id: FIXTURES.rolloutProject,
        tenantId: FIXTURES.pilotTenant,
        departmentId: FIXTURES.deliveryDept,
        name: "Pilot rollout",
      },
      {
        id: FIXTURES.restrictedProject,
        tenantId: FIXTURES.pilotTenant,
        departmentId: FIXTURES.deliveryDept,
        name: "Restricted project",
      },
      {
        id: FIXTURES.otherProject,
        tenantId: FIXTURES.otherTenant,
        departmentId: FIXTURES.otherDept,
        name: "Other work",
      },
    ],
    memberships: [
      { tenantId: FIXTURES.pilotTenant, userId: FIXTURES.reviewer, role: "reviewer" },
      { tenantId: FIXTURES.pilotTenant, userId: FIXTURES.member, role: "member" },
      { tenantId: FIXTURES.pilotTenant, userId: FIXTURES.admin, role: "admin" },
      { tenantId: FIXTURES.otherTenant, userId: FIXTURES.outsider, role: "reviewer" },
    ],
    grants: [reviewerGrant, memberGrant, outsiderGrant],
    transcripts: [],
    jobs: [],
    events: [],
    units: [],
    payloads: new Map(),
  };
}

export function getMemoryRepository(): MemoryRepository {
  if (!globalStore.__enterpriseMind) globalStore.__enterpriseMind = new MemoryRepository();
  return globalStore.__enterpriseMind;
}

export function resetMemoryRepository(): MemoryRepository {
  const repo = new MemoryRepository();
  globalStore.__enterpriseMind = repo;
  return repo;
}
