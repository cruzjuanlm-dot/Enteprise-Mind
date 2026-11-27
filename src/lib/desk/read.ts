import fs from "node:fs";
import path from "node:path";
import { parseFrontmatter, TYPE_LABEL, projectSlug, type TypeCode, type UnitDomain, type UnitScope } from "../frontmatter";
import { collectUnits, type UnitIndexEntry } from "../unit-index";
import type { DeskSnapshot, DeskUnit } from "./types";

export type VisibleUnit = {
  id: string;
  title: string;
  type: TypeCode;
  scope: UnitScope;
  project: string;
  sourceId: string;
  version: number;
  status: string;
  owner: string;
  entities: string[];
  supersedes: string | null;
  path: string;
  origin: "git" | "session";
  excerpt: string | null;
  body: string;
  domain: UnitDomain | null;
  acceptanceCriteria: string | null;
  systemsTouched: string[];
};

export type CoreArea = {
  slug: string;
  title: string;
  group: string;
  file: string;
  blurb: string;
};

export const CORE_AREAS: CoreArea[] = [
  {
    slug: "market",
    title: "Market",
    group: "Value flow",
    file: "core/value-flow/market/README.md",
    blurb: "How Hearthline finds teaching studios.",
  },
  {
    slug: "acquire",
    title: "Acquire",
    group: "Value flow",
    file: "core/value-flow/acquire/README.md",
    blurb: "How a studio starts using an instrument.",
  },
  {
    slug: "deliver",
    title: "Deliver",
    group: "Value flow",
    file: "core/value-flow/deliver/README.md",
    blurb: "How a curve moves from the bench to the studio sheet.",
  },
  {
    slug: "retain",
    title: "Retain",
    group: "Value flow",
    file: "core/value-flow/retain/README.md",
    blurb: "How a studio keeps using the instrument.",
  },
  {
    slug: "enable",
    title: "Enable",
    group: "Enable",
    file: "core/enable/README.md",
    blurb: "Shared catalog practice.",
  },
  {
    slug: "govern",
    title: "Govern",
    group: "Governance",
    file: "core/govern/README.md",
    blurb: "Rules for what the company keeps.",
  },
];

export function areaBySlug(slug: string): CoreArea | null {
  return CORE_AREAS.find((area) => area.slug === slug) ?? null;
}

export function readAreaText(root: string, area: CoreArea): string {
  const file = path.join(root, area.file);
  if (!fs.existsSync(file)) return "";
  return fs.readFileSync(file, "utf8").replace(/^#\s+.*\n+/, "").trim();
}

export function visibleUnits(root: string, state: DeskSnapshot): VisibleUnit[] {
  const git = collectUnits(root).map((entry) => fromGit(root, entry, state.promotions[entry.id]));
  const session = state.units.map((unit) => fromSession(unit));
  const merged = new Map<string, VisibleUnit>();
  for (const unit of git) merged.set(unit.id, unit);
  for (const unit of session) merged.set(unit.id, unit);
  return [...merged.values()].sort((left, right) => left.title.localeCompare(right.title) || left.id.localeCompare(right.id));
}

export function unitById(units: VisibleUnit[], id: string): VisibleUnit | null {
  return units.find((unit) => unit.id === id) ?? null;
}

export function searchUnits(units: VisibleUnit[], query: string, names: Map<string, string>): VisibleUnit[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return units.filter((unit) => haystack(unit, names).includes(needle));
}

export function provenanceFor(unit: VisibleUnit, units: VisibleUnit[]): {
  supersededBy: VisibleUnit[];
  supersedes: VisibleUnit[];
} {
  const supersededBy = units.filter((item) => item.supersedes === unit.id);
  const supersedes: VisibleUnit[] = [];
  const seen = new Set<string>([unit.id]);
  let current = unit.supersedes;
  while (current && !seen.has(current)) {
    seen.add(current);
    const next = units.find((item) => item.id === current);
    if (!next) break;
    supersedes.push(next);
    current = next.supersedes;
  }
  return { supersededBy, supersedes };
}

export function projectsIn(units: VisibleUnit[], names: Map<string, string>): { id: string; slug: string; name: string; units: VisibleUnit[] }[] {
  const ids = [...new Set(units.map((unit) => unit.project))].sort();
  return ids.map((id) => ({
    id,
    slug: safeSlug(id),
    name: names.get(id) ?? id,
    units: units.filter((unit) => unit.project === id),
  }));
}

function fromGit(root: string, entry: UnitIndexEntry, promotion: UnitDomain | undefined): VisibleUnit {
  const absolute = path.join(root, entry.path);
  let body = "";
  if (fs.existsSync(absolute)) {
    body = parseFrontmatter(fs.readFileSync(absolute, "utf8")).body.trim();
  }
  return {
    id: entry.id,
    title: entry.title,
    type: entry.type,
    scope: promotion ? "company" : entry.scope,
    project: entry.project,
    sourceId: entry.sourceId,
    version: entry.version,
    status: entry.status,
    owner: entry.owner,
    entities: entry.entities,
    supersedes: entry.supersedes,
    path: entry.path,
    origin: "git",
    excerpt: null,
    body,
    domain: promotion ?? entry.domain,
    acceptanceCriteria: entry.acceptanceCriteria,
    systemsTouched: entry.systemsTouched,
  };
}

function fromSession(unit: DeskUnit): VisibleUnit {
  return {
    id: unit.id,
    title: unit.title,
    type: unit.type,
    scope: unit.scope,
    project: unit.projectId,
    sourceId: unit.sourceId,
    version: unit.version,
    status: unit.status,
    owner: unit.owner,
    entities: unit.entities,
    supersedes: unit.supersedes,
    path: unit.path,
    origin: "session",
    excerpt: unit.excerpt,
    body: unit.body,
    domain: unit.domain,
    acceptanceCriteria: unit.acceptanceCriteria,
    systemsTouched: unit.systemsTouched,
  };
}

function haystack(unit: VisibleUnit, names: Map<string, string>): string {
  const entityNames = unit.entities.map((id) => names.get(id) ?? id);
  return [unit.id, unit.title, unit.body, unit.type, TYPE_LABEL[unit.type], unit.scope, unit.domain ?? "", unit.sourceId, unit.owner, names.get(unit.owner) ?? "", ...entityNames]
    .join("\n")
    .toLowerCase();
}

function safeSlug(projectId: string): string {
  try {
    return projectSlug(projectId);
  } catch {
    return projectId;
  }
}
