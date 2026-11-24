import fs from "node:fs";
import path from "node:path";
import { loadEntities } from "../entity-read";
import { parseFrontmatter } from "../frontmatter";
import { loadSeedEntities } from "../ontology";
import type { TokenScope } from "../tokens/scopes";
import { collectUnits } from "../unit-index";

export const MCP_TOOL_SCOPES = {
  search_units: "units:read",
  get_unit: "units:read",
  list_entities: "entities:read",
  list_action_items: "action_items:read",
  send_meeting_bot: "meetings:write",
} as const satisfies Record<string, TokenScope>;

export type McpToolName = keyof typeof MCP_TOOL_SCOPES;

export function searchUnits(query: string, root: string) {
  const needle = query.trim().toLowerCase();
  return collectUnits(root)
    .filter((unit) => unit.title.toLowerCase().includes(needle) || unit.id.toLowerCase().includes(needle))
    .map((unit) => ({ id: unit.id, title: unit.title, bucket: unit.bucket, path: unit.path }));
}

export function readUnit(id: string, root: string): { id: string; title: string; bucket: string; path: string; body: string } | null {
  const entry = collectUnits(root).find((unit) => unit.id === id);
  if (!entry) return null;
  const unitsRoot = path.resolve(root, "units");
  const full = path.resolve(root, entry.path);
  if (full !== unitsRoot && !full.startsWith(`${unitsRoot}${path.sep}`)) return null;
  const parsed = parseFrontmatter(fs.readFileSync(full, "utf8"));
  return { id: entry.id, title: entry.title, bucket: entry.bucket, path: entry.path, body: parsed.body.trim() };
}

export async function listCatalogEntities(env: NodeJS.ProcessEnv, root: string) {
  const page = await loadEntities({ root, env });
  return page.entities.map((entity) => ({
    id: entity.id,
    type: entity.type,
    name: entity.name,
    summary: entity.summary,
  }));
}

export function listCatalogActionItems(root: string) {
  return loadSeedEntities(root)
    .filter((entity) => entity.type === "action_item")
    .map((entity) => ({
      id: entity.id,
      name: entity.name,
      summary: entity.summary,
      state: String(entity.state ?? ""),
      projectId: String(entity.project_id ?? ""),
    }));
}
