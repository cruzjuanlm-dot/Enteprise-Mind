import { createClient } from "@supabase/supabase-js";
import { isPublicSupabaseConfigured } from "./env";
import {
  ENTITY_TABLE,
  ENTITY_TYPES,
  loadSeedEntities,
  loadSeedRelationships,
  type EntityType,
  type SeedEntity,
  type SeedRelationship,
} from "./ontology";

export type EntityPageData = {
  source: "seed" | "supabase";
  note: string | null;
  entities: SeedEntity[];
  relationships: SeedRelationship[];
};

const HIDDEN = new Set(["id", "type", "name", "summary", "created_at", "updated_at"]);

const LABELS: Record<string, string> = {
  kind: "Kind",
  status: "Status",
  system_id: "System",
  stage: "Stage",
  source_kind: "Source kind",
  data_source_id: "Data source",
  columns: "Columns",
  from_system_id: "From system",
  to_system_id: "To system",
  project_id: "Project",
  statement: "Statement",
  actor_role_id: "Actor role",
  requirement_id: "Requirement",
  expected: "Expected",
  target_on: "Target day",
  state: "State",
  owner_role_id: "Owner role",
  meeting_id: "Meeting",
};

export function entityAttributes(entity: SeedEntity): { label: string; value: string }[] {
  return Object.entries(entity)
    .filter(([key]) => !HIDDEN.has(key))
    .map(([key, value]) => ({ label: LABELS[key] ?? key, value: formatValue(value) }));
}

export async function loadEntities(options?: {
  root?: string;
  env?: NodeJS.ProcessEnv;
  readSupabase?: () => Promise<{ entities: SeedEntity[]; relationships: SeedRelationship[] }>;
}): Promise<EntityPageData> {
  const root = options?.root ?? process.cwd();
  const env = options?.env ?? process.env;
  const seed = seedData(root);
  if (!isPublicSupabaseConfigured(env)) {
    return {
      source: "seed",
      note: "Supabase URL and anon key are not set, so this page is showing the committed seed. That file is not checked by row level security.",
      ...seed,
    };
  }
  try {
    const live = options?.readSupabase ? await options.readSupabase() : await readSupabaseEntities(env);
    return { source: "supabase", note: null, entities: live.entities, relationships: live.relationships };
  } catch (error) {
    return {
      source: "seed",
      note: `The Supabase read failed, so this page is showing the committed seed instead. ${publicError(error)}`,
      ...seed,
    };
  }
}

function seedData(root: string): { entities: SeedEntity[]; relationships: SeedRelationship[] } {
  return { entities: loadSeedEntities(root), relationships: loadSeedRelationships(root) };
}

async function readSupabaseEntities(
  env: NodeJS.ProcessEnv,
): Promise<{ entities: SeedEntity[]; relationships: SeedRelationship[] }> {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  const supabase = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const entityBatches = await Promise.all(
    ENTITY_TYPES.map(async (type) => {
      const table = ENTITY_TABLE[type];
      const { data, error } = await supabase.from(table).select("*").order("id");
      if (error) throw new Error(`${table}: ${error.message}`);
      return (data ?? []).map((row) => toEntity(type, row as Record<string, unknown>));
    }),
  );
  const { data, error } = await supabase.from("entity_relationships").select("*").order("id");
  if (error) throw new Error(`entity_relationships: ${error.message}`);
  const relationships = (data ?? []).map((row) => {
    const record = row as Record<string, unknown>;
    return {
      id: String(record.id),
      type: String(record.relationship_type),
      from: String(record.from_id),
      to: String(record.to_id),
    };
  });
  return { entities: entityBatches.flat(), relationships };
}

function toEntity(type: EntityType, row: Record<string, unknown>): SeedEntity {
  return {
    ...row,
    id: String(row.id),
    type,
    name: String(row.name ?? ""),
    summary: String(row.summary ?? ""),
  };
}

function formatValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value) && value.every((item) => isNamed(item))) {
    return value.map((item) => item.name).join(", ");
  }
  return JSON.stringify(value);
}

function isNamed(value: unknown): value is { name: string } {
  return Boolean(value) && typeof value === "object" && typeof (value as { name?: unknown }).name === "string";
}

function publicError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown error";
  return message.replace(/https?:\/\/\S+/g, "[url]").slice(0, 180);
}
