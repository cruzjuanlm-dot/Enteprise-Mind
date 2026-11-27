import { createHash } from "node:crypto";
import type { UnitType } from "../domain";
import { deniedTerms } from "../denylist";
import { extractDeterministic } from "../extract";
import type { TypeCode } from "../frontmatter";
import { DESK_PROJECT_ID, type CompilationRecord, type DeskProposal, type DeskSnapshot } from "./types";

const ROLE_HINTS: { id: string; pattern: RegExp }[] = [
  { id: "person-role.calibration-owner", pattern: /calibration owner/i },
  { id: "person-role.studio-lead", pattern: /studio lead/i },
  { id: "person-role.catalog-editor", pattern: /catalog editor/i },
];

const ENTITY_HINTS: { id: string; pattern: RegExp }[] = [
  { id: "environment.kiln-ledger-bench", pattern: /kiln ledger bench/i },
  { id: "system.kiln-ledger", pattern: /kiln ledger/i },
  { id: "system.studio-portal", pattern: /studio portal/i },
  { id: "data-source.firing-curves", pattern: /firing curve/i },
  { id: "workflow.calibration-check", pattern: /calibration check|bench checklist/i },
  { id: "decision.no-recordings", pattern: /no firing recording|recordings out|without a recording/i },
];

// One map from the pilot labels to the seven catalog codes.
// Where risk, pending_task, and glossary_term land is still open, so this function is the only place that chooses.
export function catalogTypeFor(unitType: UnitType): TypeCode {
  switch (unitType) {
    case "design_decision":
      return "DEC";
    case "architecture":
      return "ARC";
    case "pending_task":
      return "REQ";
    case "glossary_term":
      return "BR";
    case "risk":
    case "open_question":
      return "OQ";
  }
}

export function sourceIdFor(text: string): string {
  const hash = createHash("sha256").update(text).digest("hex").slice(0, 8);
  return `source.c${hash}`;
}

export function ownerRole(name: string | null, knownIds: Set<string>): string {
  const fallback = "person-role.catalog-editor";
  if (name) {
    for (const hint of ROLE_HINTS) {
      if (hint.pattern.test(name) && knownIds.has(hint.id)) return hint.id;
    }
  }
  return knownIds.has(fallback) ? fallback : fallback;
}

export function entitiesFor(
  input: { ownerName: string | null; systems: string[]; title: string; body: string; projectId: string },
  knownIds: Set<string>,
): { owner: string; entities: string[] } {
  const owner = ownerRole(input.ownerName, knownIds);
  const haystack = [input.title, input.body, ...input.systems].join("\n");
  const entities = new Set<string>();
  if (knownIds.has(input.projectId)) entities.add(input.projectId);
  if (knownIds.has(owner)) entities.add(owner);
  for (const hint of ENTITY_HINTS) {
    if (hint.pattern.test(haystack) && knownIds.has(hint.id)) entities.add(hint.id);
  }
  return { owner, entities: [...entities] };
}

export type CompileOutcome = {
  ok: boolean;
  reason: "empty" | "denied" | "unlabeled" | "duplicate" | null;
  proposals: DeskProposal[];
  state: DeskSnapshot;
};

export function addCompilation(state: DeskSnapshot, text: string, now: string): CompileOutcome {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, reason: "empty", proposals: [], state };
  if (deniedTerms(trimmed).length > 0) return { ok: false, reason: "denied", proposals: [], state };

  const drafts = extractDeterministic(trimmed);
  const sourceId = sourceIdFor(trimmed);
  const already = state.proposals.filter((proposal) => proposal.sourceId === sourceId);
  const published = state.units.some((unit) => unit.sourceId === sourceId);
  if (already.length > 0 || published) {
    return {
      ok: true,
      reason: "duplicate",
      proposals: already.filter((proposal) => proposal.status === "proposed"),
      state,
    };
  }
  if (drafts.length === 0) {
    const record: CompilationRecord = {
      id: `compilation.${sourceId.slice("source.".length)}`,
      sourceId,
      proposalCount: 0,
      createdAt: now,
    };
    return {
      ok: true,
      reason: "unlabeled",
      proposals: [],
      state: { ...state, compilations: [...state.compilations, record] },
    };
  }

  const short = sourceId.slice("source.".length);
  const proposals: DeskProposal[] = drafts.map((draft, index) => ({
    id: `proposal.${short}-${String(index + 1).padStart(2, "0")}`,
    title: draft.title,
    type: catalogTypeFor(draft.unitType),
    body: draft.body,
    excerpt: draft.sourceExcerpt,
    scope: "project",
    projectId: DESK_PROJECT_ID,
    sourceId,
    ownerName: draft.ownerName,
    systems: draft.systemsTouched,
    acceptance: draft.acceptancePresence === "known" ? draft.acceptanceCriteria : null,
    domain: null,
    status: "proposed",
    createdAt: now,
  }));
  const record: CompilationRecord = {
    id: `compilation.${short}`,
    sourceId,
    proposalCount: proposals.length,
    createdAt: now,
  };
  return {
    ok: true,
    reason: null,
    proposals,
    state: {
      ...state,
      proposals: [...state.proposals, ...proposals],
      compilations: [...state.compilations, record],
    },
  };
}
