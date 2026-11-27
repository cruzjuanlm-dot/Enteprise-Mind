import type { UnitIndexEntry } from "./unit-index";

export type UnitPin = {
  id: string;
  unit_path: string;
  commit_sha: string;
};

export function unitPins(units: UnitIndexEntry[], changedPaths: readonly string[], sha: string): UnitPin[] {
  if (!/^[0-9a-f]{7,64}$/.test(sha)) return [];
  const changed = new Set(changedPaths);
  return units
    .filter((unit) => changed.has(unit.path))
    .map((unit) => ({ id: unit.id, unit_path: unit.path, commit_sha: sha }));
}
