import fs from "node:fs";
import path from "node:path";
import { asStrings, parseFrontmatter } from "./frontmatter";
import { loadSeedEntities } from "./ontology";
import { readUnitIndex, type UnitIndexEntry } from "./unit-index";

export type CompEntry = {
  id: string;
  title: string;
  summary: string;
  status: string;
  owner: string;
  units: string[];
  entities: string[];
  body: string;
};

export function listUnits(): UnitIndexEntry[] {
  return readUnitIndex(process.cwd());
}

export function readUnit(entry: UnitIndexEntry): { entry: UnitIndexEntry; body: string } {
  const unitsRoot = path.resolve(process.cwd(), "units");
  const full = path.resolve(process.cwd(), entry.path);
  if (full !== unitsRoot && !full.startsWith(`${unitsRoot}${path.sep}`)) {
    throw new Error("Unit path escapes the units directory.");
  }
  const markdown = fs.readFileSync(full, "utf8");
  return { entry, body: parseFrontmatter(markdown).body.trim() };
}

export function listComps(): CompEntry[] {
  const directory = path.join(process.cwd(), "comps");
  if (!fs.existsSync(directory)) return [];
  const comps: CompEntry[] = [];
  for (const id of fs.readdirSync(directory)) {
    const file = path.join(directory, id, "COMP.md");
    if (!fs.existsSync(file)) continue;
    const { data, body } = parseFrontmatter(fs.readFileSync(file, "utf8"));
    comps.push({
      id: String(data.id),
      title: String(data.title),
      summary: String(data.summary ?? ""),
      status: String(data.status),
      owner: String(data.owner),
      units: asStrings(data.units, "units"),
      entities: asStrings(data.entities, "entities"),
      body: body.trim(),
    });
  }
  return comps.sort((left, right) => left.id.localeCompare(right.id));
}

export function entityNames(): Map<string, string> {
  return new Map(loadSeedEntities().map((entity) => [entity.id, entity.name]));
}
