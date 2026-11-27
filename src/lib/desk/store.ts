import { collectUnits } from "../unit-index";
import { loadSeedEntities } from "../ontology";
import { addCompilation, type CompileOutcome } from "./compile";
import { advanceMeeting, approveProposal, promoteUnit, rejectProposal, reviseUnit, saveProposal, type ReviewOutcome } from "./review";
import { emptyDesk, type DeskProposal, type DeskSnapshot, type DeskUnit, type ProposalPatch } from "./types";

const globalDesk = globalThis as typeof globalThis & {
  __enterpriseMindDesk?: DeskSnapshot;
};

export function deskSnapshot(): DeskSnapshot {
  globalDesk.__enterpriseMindDesk ??= emptyDesk();
  return globalDesk.__enterpriseMindDesk;
}

export function replaceDesk(next: DeskSnapshot): void {
  globalDesk.__enterpriseMindDesk = next;
}

export function resetDesk(): void {
  globalDesk.__enterpriseMindDesk = emptyDesk();
}

export function knownEntityIds(root = process.cwd()): Set<string> {
  return new Set(loadSeedEntities(root).map((entity) => entity.id));
}

export function gitUnitIds(root = process.cwd()): string[] {
  return collectUnits(root).map((unit) => unit.id);
}

export function compileTranscript(text: string, now = new Date().toISOString()): CompileOutcome {
  const outcome = addCompilation(deskSnapshot(), text, now);
  replaceDesk(outcome.state);
  return outcome;
}

export function saveDeskProposal(id: string, patch: ProposalPatch): ReviewOutcome<DeskProposal> {
  const outcome = saveProposal(deskSnapshot(), id, patch);
  if (outcome.ok) replaceDesk(outcome.state);
  return outcome;
}

export function rejectDeskProposal(id: string): ReviewOutcome<DeskProposal> {
  const outcome = rejectProposal(deskSnapshot(), id);
  if (outcome.ok) replaceDesk(outcome.state);
  return outcome;
}

export function approveDeskProposal(
  id: string,
  patch: ProposalPatch,
  now = new Date().toISOString(),
  root = process.cwd(),
): ReviewOutcome<DeskUnit> {
  const state = deskSnapshot();
  const ids = [...gitUnitIds(root), ...state.units.map((unit) => unit.id)];
  const outcome = approveProposal(state, id, patch, ids, knownEntityIds(root), now);
  if (outcome.ok) replaceDesk(outcome.state);
  return outcome;
}

export function reviseDeskUnit(id: string, patch: ProposalPatch, now = new Date().toISOString()): ReviewOutcome<DeskUnit> {
  const outcome = reviseUnit(deskSnapshot(), id, patch, now);
  if (outcome.ok) replaceDesk(outcome.state);
  return outcome;
}

export function promoteDeskUnit(
  id: string,
  domain: string,
  root = process.cwd(),
): ReviewOutcome<{ id: string; scope: "company"; domain: import("../frontmatter").UnitDomain }> {
  const outcome = promoteUnit(deskSnapshot(), id, new Set(gitUnitIds(root)), domain);
  if (outcome.ok) replaceDesk(outcome.state);
  return outcome;
}

export function advanceDeskMeeting(): DeskSnapshot {
  const next = advanceMeeting(deskSnapshot());
  replaceDesk(next);
  return next;
}
