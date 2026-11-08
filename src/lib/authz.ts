import type { Actor, KnowledgeUnit, Project, TenantRole, Transcript } from "./domain";
import { roleIn } from "./domain";

function grant(actor: Actor, tenantId: string, projectId: string) {
  const membership = actor.memberships.find((item) => item.tenantId === tenantId);
  return membership?.projects.find((project) => project.projectId === projectId) ?? null;
}

export function canReadProject(actor: Actor, project: Pick<Project, "id" | "tenantId">): boolean {
  const role = roleIn(actor, project.tenantId);
  if (!role) return false;
  if (role === "admin") return true;
  return grant(actor, project.tenantId, project.id) !== null;
}

export function canReadTranscript(actor: Actor, transcript: Pick<Transcript, "tenantId" | "projectId">): boolean {
  const role = roleIn(actor, transcript.tenantId);
  if (!role) return false;
  if (role === "admin") return true;
  if (!transcript.projectId) return role === "reviewer";
  const projectGrant = grant(actor, transcript.tenantId, transcript.projectId);
  if (!projectGrant) return false;
  if (role === "reviewer") return true;
  return projectGrant.canReadTranscripts;
}

export function canReadUnit(
  actor: Actor,
  unit: Pick<KnowledgeUnit, "tenantId" | "projectId" | "reviewState">,
): boolean {
  const role = roleIn(actor, unit.tenantId);
  if (!role) return false;
  if (role === "admin") return true;
  if (unit.projectId) {
    if (!grant(actor, unit.tenantId, unit.projectId)) return false;
  } else if (role !== "reviewer" && role !== "approver") {
    return false;
  }
  if (role === "reviewer" || role === "approver") return true;
  return unit.reviewState === "accepted" || unit.reviewState === "edited" || unit.reviewState === "merged";
}

export function canReviewUnit(
  actor: Actor,
  unit: Pick<KnowledgeUnit, "tenantId" | "projectId" | "reviewState">,
): boolean {
  if (unit.reviewState !== "proposed") return false;
  const role = roleIn(actor, unit.tenantId);
  if (role !== "admin" && role !== "reviewer") return false;
  if (role === "admin" || !unit.projectId) return true;
  return grant(actor, unit.tenantId, unit.projectId) !== null;
}

export function canIngest(actor: Actor, tenantId: string): boolean {
  const role = roleIn(actor, tenantId);
  return role === "admin" || role === "reviewer";
}

export function canManageJobs(actor: Actor, tenantId: string): boolean {
  const role = roleIn(actor, tenantId);
  return role === "admin" || role === "reviewer";
}

export function canSeeJobs(actor: Actor, tenantId: string): boolean {
  const role: TenantRole | null = roleIn(actor, tenantId);
  return role === "admin" || role === "reviewer" || role === "approver";
}

export function visibleDepartmentIds(actor: Actor, projects: Project[]): Set<string> {
  const ids = new Set<string>();
  for (const project of projects) {
    if (canReadProject(actor, project)) ids.add(project.departmentId);
  }
  return ids;
}
