import { asDomain, nextUnitId, projectSlug, TYPE_CODES, type TypeCode, type UnitDomain, type UnitScope } from "../frontmatter";
import { deniedTerms } from "../denylist";
import { entitiesFor } from "./compile";
import {
  type DeskProposal,
  type DeskSnapshot,
  type DeskUnit,
  type ProposalPatch,
} from "./types";

export type ReviewFailure = "missing" | "rejected" | "denied" | "invalid";

export type ReviewOutcome<T> = { ok: true; state: DeskSnapshot; value: T } | { ok: false; reason: ReviewFailure; state: DeskSnapshot };

const SCOPES = new Set<UnitScope>(["project", "company"]);

export function saveProposal(state: DeskSnapshot, id: string, patch: ProposalPatch): ReviewOutcome<DeskProposal> {
  const current = state.proposals.find((proposal) => proposal.id === id);
  if (!current) return { ok: false, reason: "missing", state };
  if (current.status === "rejected") return { ok: false, reason: "rejected", state };
  const next = applyPatch(current, patch);
  if (!next) return { ok: false, reason: "invalid", state };
  if (deniedTerms(`${next.title}\n${next.body}`).length > 0) return { ok: false, reason: "denied", state };
  return { ok: true, value: next, state: replaceProposal(state, next) };
}

export function rejectProposal(state: DeskSnapshot, id: string): ReviewOutcome<DeskProposal> {
  const current = state.proposals.find((proposal) => proposal.id === id);
  if (!current) return { ok: false, reason: "missing", state };
  if (current.status === "rejected") return { ok: true, value: current, state };
  const next: DeskProposal = { ...current, status: "rejected" };
  return { ok: true, value: next, state: replaceProposal(state, next) };
}

export function approveProposal(
  state: DeskSnapshot,
  id: string,
  patch: ProposalPatch,
  existingIds: string[],
  knownEntityIds: Set<string>,
  now: string,
): ReviewOutcome<DeskUnit> {
  const saved = saveProposal(state, id, patch);
  if (!saved.ok) return saved;
  const proposal = saved.value;
  const linked = entitiesFor(proposal, knownEntityIds);
  const unitId = nextUnitId(existingIds, proposal.projectId, proposal.sourceId.slice("source.".length), proposal.type);
  const slug = projectSlug(proposal.projectId);
  const unit: DeskUnit = {
    id: unitId,
    title: proposal.title,
    type: proposal.type,
    scope: proposal.scope,
    projectId: proposal.projectId,
    sourceId: proposal.sourceId,
    version: 1,
    status: "accepted",
    owner: linked.owner,
    entities: linked.entities,
    supersedes: null,
    body: unitBody(proposal),
    path: `projects/${slug}/units/${unitId}.md`,
    excerpt: proposal.excerpt,
    origin: "session",
    domain: proposal.domain,
    acceptanceCriteria: proposal.acceptance,
    systemsTouched: proposal.systems,
    createdAt: now,
  };
  return {
    ok: true,
    value: unit,
    state: {
      ...saved.state,
      proposals: saved.state.proposals.filter((item) => item.id !== proposal.id),
      units: [...saved.state.units, unit],
    },
  };
}

export function reviseUnit(state: DeskSnapshot, id: string, patch: ProposalPatch, now: string): ReviewOutcome<DeskUnit> {
  const current = state.units.find((unit) => unit.id === id);
  if (!current || current.origin !== "session") return { ok: false, reason: "missing", state };
  const title = clean(patch.title ?? current.title, 200);
  const body = clean(patch.body ?? current.body, 4000);
  const scope = patch.scope === undefined ? current.scope : asScope(patch.scope);
  const domain = patch.domain === undefined ? current.domain : patch.domain === "" ? null : asDomain(patch.domain);
  const acceptance = patch.acceptance === undefined ? current.acceptanceCriteria : clean(patch.acceptance, 1000) || null;
  if (!title || !body || !scope || domain === undefined) return { ok: false, reason: "invalid", state };
  if (!scopeAllows(scope, domain, current.type, acceptance)) return { ok: false, reason: "invalid", state };
  if (deniedTerms(`${title}\n${body}`).length > 0) return { ok: false, reason: "denied", state };
  const next: DeskUnit = {
    ...current,
    title,
    body,
    scope,
    domain,
    acceptanceCriteria: acceptance,
    version: current.version + 1,
    createdAt: now,
  };
  return {
    ok: true,
    value: next,
    state: { ...state, units: state.units.map((unit) => (unit.id === id ? next : unit)) },
  };
}

export function promoteUnit(
  state: DeskSnapshot,
  id: string,
  gitIds: Set<string>,
  domain: string,
): ReviewOutcome<{ id: string; scope: "company"; domain: UnitDomain }> {
  const routed = asDomain(domain);
  if (!routed) return { ok: false, reason: "invalid", state };
  const session = state.units.find((unit) => unit.id === id);
  if (session) {
    const next: DeskUnit = { ...session, scope: "company", domain: routed };
    return {
      ok: true,
      value: { id, scope: "company", domain: routed },
      state: { ...state, units: state.units.map((unit) => (unit.id === id ? next : unit)) },
    };
  }
  if (!gitIds.has(id)) return { ok: false, reason: "missing", state };
  return {
    ok: true,
    value: { id, scope: "company", domain: routed },
    state: { ...state, promotions: { ...state.promotions, [id]: routed } },
  };
}

export const MEETING_STEP_COUNT = 6;

export function advanceMeeting(state: DeskSnapshot): DeskSnapshot {
  if (state.meetingStep >= MEETING_STEP_COUNT - 1) return { ...state, meetingStep: 0 };
  return { ...state, meetingStep: state.meetingStep + 1 };
}

function applyPatch(current: DeskProposal, patch: ProposalPatch): DeskProposal | null {
  const title = patch.title === undefined ? current.title : clean(patch.title, 200);
  const body = patch.body === undefined ? current.body : clean(patch.body, 4000);
  const type = patch.type === undefined ? current.type : asType(patch.type);
  const scope = patch.scope === undefined ? current.scope : asScope(patch.scope);
  const domain = patch.domain === undefined ? current.domain : patch.domain === "" ? null : asDomain(patch.domain);
  const acceptance = patch.acceptance === undefined ? current.acceptance : clean(patch.acceptance, 1000) || null;
  if (!title || !body || !type || !scope || domain === undefined) return null;
  if (!scopeAllows(scope, domain, type, acceptance)) return null;
  return { ...current, title, body, type, scope, domain, acceptance };
}

function scopeAllows(
  scope: UnitScope,
  domain: UnitDomain | null,
  type: TypeCode,
  acceptance: string | null,
): boolean {
  if (scope === "company" && !domain) return false;
  if (type === "REQ" && !acceptance) return false;
  return true;
}

function replaceProposal(state: DeskSnapshot, proposal: DeskProposal): DeskSnapshot {
  return {
    ...state,
    proposals: state.proposals.map((item) => (item.id === proposal.id ? proposal : item)),
  };
}

function unitBody(proposal: DeskProposal): string {
  const owner = proposal.ownerName ?? "Unknown";
  const systems = proposal.systems.length > 0 ? proposal.systems.join(", ") : "Unknown";
  const acceptance = proposal.acceptance ?? "Unknown";
  return [
    "## Statement",
    "",
    proposal.body,
    "",
    "## Named owner",
    "",
    owner,
    "",
    "## Systems",
    "",
    systems,
    "",
    "## Acceptance",
    "",
    acceptance,
    "",
  ].join("\n");
}

function asType(value: string): TypeCode | null {
  return TYPE_CODES.find((code) => code === value) ?? null;
}

function asScope(value: string): UnitScope | null {
  return SCOPES.has(value as UnitScope) ? (value as UnitScope) : null;
}

function clean(value: string, max: number): string {
  return value.trim().slice(0, max);
}
