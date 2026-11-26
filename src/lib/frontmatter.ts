import { parse } from "yaml";

export const TYPE_CODES = ["DEC", "REQ", "ARC", "DS", "BR", "WF", "OQ"] as const;
export type TypeCode = (typeof TYPE_CODES)[number];

export const SCOPES = ["project", "company"] as const;
export type UnitScope = (typeof SCOPES)[number];

export const TYPE_LABEL: Record<TypeCode, string> = {
  DEC: "Decision",
  REQ: "Requirement",
  ARC: "Architecture",
  DS: "Design",
  BR: "Business rule",
  WF: "Workflow",
  OQ: "Open question",
};

export const TYPE_BLURB: Record<TypeCode, string> = {
  DEC: "A choice that governs later work.",
  REQ: "A requirement the work must meet.",
  ARC: "How systems are split and how they connect.",
  DS: "A screen, sheet, or structure a person uses.",
  BR: "A rule the work follows.",
  WF: "An SOP, training, or workflow how-to.",
  OQ: "A question or source summary that is not settled.",
};

const UNIT_ID = /^([a-z0-9]+(?:-[a-z0-9]+)*)-([a-z0-9]+)-(DEC|REQ|ARC|DS|BR|WF|OQ)-(\d{3})$/;

export function parseFrontmatter(markdown: string): { data: Record<string, unknown>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(markdown);
  if (!match) throw new Error("Missing YAML frontmatter.");
  const data = parse(match[1]);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Frontmatter must be a mapping.");
  }
  return { data: data as Record<string, unknown>, body: match[2].replace(/^\n/, "") };
}

export function asStrings(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${label} must be a list of strings.`);
  }
  return value;
}

export function projectSlug(projectId: string): string {
  if (!/^project\.[a-z0-9]+(?:-[a-z0-9]+)*$/.test(projectId)) {
    throw new Error(`Project id ${projectId} is not a catalog project id.`);
  }
  return projectId.slice("project.".length);
}

export function unitRelativePath(projectId: string, id: string): string {
  return `projects/${projectSlug(projectId)}/units/${id}.md`;
}

export function parseUnitId(id: string): { projectSlug: string; sourceShort: string; type: TypeCode; seq: string } | null {
  const match = UNIT_ID.exec(id);
  if (!match) return null;
  return {
    projectSlug: match[1],
    sourceShort: match[2],
    type: match[3] as TypeCode,
    seq: match[4],
  };
}

export function nextUnitId(existingIds: Iterable<string>, projectId: string, sourceShort: string, type: TypeCode): string {
  if (!/^[a-z0-9]+$/.test(sourceShort)) throw new Error("Source short must be lowercase letters and digits.");
  const prefix = `${projectSlug(projectId)}-${sourceShort}-${type}-`;
  let max = 0;
  for (const id of existingIds) {
    if (!id.startsWith(prefix)) continue;
    const seq = Number(id.slice(prefix.length));
    if (Number.isInteger(seq) && seq > max) max = seq;
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}
