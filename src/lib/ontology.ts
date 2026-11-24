import fs from "node:fs";
import path from "node:path";

export const ENTITY_TYPES = [
  "system",
  "environment",
  "data_source",
  "table_schema",
  "integration",
  "workflow",
  "project",
  "requirement",
  "use_case",
  "test_case",
  "milestone",
  "decision",
  "person_role",
  "action_item",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];
export type SourceOfTruth = "git" | "db" | "both";
export type MirrorDirection = "git_to_db" | "db_to_git";

export const ENTITY_TABLE: Record<EntityType, string> = {
  system: "systems",
  environment: "environments",
  data_source: "data_sources",
  table_schema: "table_schemas",
  integration: "integrations",
  workflow: "workflows",
  project: "projects",
  requirement: "requirements",
  use_case: "use_cases",
  test_case: "test_cases",
  milestone: "milestones",
  decision: "decisions",
  person_role: "person_roles",
  action_item: "action_items",
};

export const ID_PREFIX: Record<EntityType, string> = {
  system: "system",
  environment: "environment",
  data_source: "data-source",
  table_schema: "table-schema",
  integration: "integration",
  workflow: "workflow",
  project: "project",
  requirement: "requirement",
  use_case: "use-case",
  test_case: "test-case",
  milestone: "milestone",
  decision: "decision",
  person_role: "person-role",
  action_item: "action-item",
};

export const ENTITY_LABEL: Record<EntityType, string> = {
  system: "System",
  environment: "Environment",
  data_source: "Data source",
  table_schema: "Table schema",
  integration: "Integration",
  workflow: "Workflow",
  project: "Project",
  requirement: "Requirement",
  use_case: "Use case",
  test_case: "Test case",
  milestone: "Milestone",
  decision: "Decision",
  person_role: "Person role",
  action_item: "Action item",
};

export type OntologyDeclaration = {
  type: EntityType;
  title: string;
  sourceOfTruth: SourceOfTruth;
  mirrorDirection: MirrorDirection;
  mirrorNote: string;
  table: string;
};

export type SeedEntity = {
  id: string;
  type: EntityType;
  name: string;
  summary: string;
} & Record<string, unknown>;

export type SeedRelationship = {
  id: string;
  type: string;
  from: string;
  to: string;
};

export function entityTypeFromId(id: string): EntityType | null {
  const prefix = id.split(".")[0];
  return ENTITY_TYPES.find((type) => ID_PREFIX[type] === prefix) ?? null;
}

export function loadDeclarations(root = process.cwd()): OntologyDeclaration[] {
  return ENTITY_TYPES.map((type) => {
    const schema = readJson(path.join(root, "ontology/entities", `${type}.schema.json`));
    return {
      type,
      title: typeof schema.title === "string" ? schema.title : ENTITY_LABEL[type],
      sourceOfTruth: schema["x-source-of-truth"] as SourceOfTruth,
      mirrorDirection: schema["x-mirror-direction"] as MirrorDirection,
      mirrorNote: typeof schema["x-mirror-note"] === "string" ? schema["x-mirror-note"] : "",
      table: ENTITY_TABLE[type],
    };
  });
}

export function loadSeedEntities(root = process.cwd()): SeedEntity[] {
  return readJson(path.join(root, "ontology/seed/entities.json")) as unknown as SeedEntity[];
}

export function loadSeedRelationships(root = process.cwd()): SeedRelationship[] {
  return readJson(path.join(root, "ontology/seed/relationships.json")) as unknown as SeedRelationship[];
}

function readJson(file: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
}
