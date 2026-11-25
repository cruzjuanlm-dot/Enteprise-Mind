import Ajv, { type AnySchemaObject, type ErrorObject, type ValidateFunction } from "ajv/dist/2020";
import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { deniedTerms } from "./denylist";
import { BUCKETS, parseFrontmatter } from "./frontmatter";
import { ENTITY_TYPES, entityTypeFromId, ID_PREFIX, type EntityType } from "./ontology";

export type Issue = { file: string; message: string };

const REF_PREFIX: Record<string, string> = {
  system_id: "system.",
  data_source_id: "data-source.",
  from_system_id: "system.",
  to_system_id: "system.",
  project_id: "project.",
  actor_role_id: "person-role.",
  requirement_id: "requirement.",
  owner_role_id: "person-role.",
};

const TEXT_EXTENSIONS = new Set([".md", ".json", ".yaml", ".yml", ".sql", ".ts", ".tsx", ".css", ".mjs"]);
const DENYLIST_SKIP = new Set([path.normalize("src/lib/denylist.ts")]);
const DENYLIST_ROOTS = [
  "units",
  "comps",
  "ontology",
  "schema",
  "src",
  "README.md",
  "supabase/seed_entities.sql",
  "supabase/seed_meetings.sql",
  "supabase/migrations/20261123120000_entities.sql",
  "supabase/migrations/20261124120000_meetings.sql",
  "supabase/migrations/20261125120000_admin_tokens.sql",
  "supabase/seed_admin.sql",
];

type Edge = { type: string; from: string; to: string };

export function validateRepository(root: string): Issue[] {
  const issues: Issue[] = [];
  const ajv = new Ajv({ allErrors: true, strict: false });
  const unitSchema = readJson(root, "schema/unit.schema.json", issues);
  const compSchema = readJson(root, "schema/comp.schema.json", issues);
  const entities = readJson(root, "ontology/seed/entities.json", issues);
  const relationships = readJson(root, "ontology/seed/relationships.json", issues);
  const catalog = readYaml(root, "ontology/relationships.yaml", issues);
  const validateUnit = compile(ajv, unitSchema);
  const validateComp = compile(ajv, compSchema);
  const schemas = loadEntitySchemas(root, ajv, issues);

  const entityIds = new Set<string>();
  const countByType = new Map<string, number>();
  if (Array.isArray(entities)) {
    entities.forEach((entity, index) => {
      const file = `ontology/seed/entities.json#/${index}`;
      if (!isRecord(entity)) {
        issues.push({ file, message: "Entity seed must be an object." });
        return;
      }
      const type = entity.type;
      if (typeof type !== "string" || !schemas.has(type)) {
        issues.push({ file, message: `Entity type ${String(type)} has no schema.` });
        return;
      }
      const validate = schemas.get(type);
      if (validate && !validate(entity)) {
        for (const error of validate.errors ?? []) issues.push({ file, message: formatAjv(error) });
      }
      if (typeof entity.id === "string") {
        if (entityIds.has(entity.id)) issues.push({ file, message: `Duplicate entity id ${entity.id}.` });
        entityIds.add(entity.id);
        const prefix = ID_PREFIX[type as EntityType];
        if (prefix && !entity.id.startsWith(`${prefix}.`)) {
          issues.push({ file, message: `Id ${entity.id} must start with ${prefix}.` });
        }
      }
      countByType.set(type, (countByType.get(type) ?? 0) + 1);
    });
    entities.forEach((entity, index) => {
      if (!isRecord(entity)) return;
      for (const [field, prefix] of Object.entries(REF_PREFIX)) {
        if (!(field in entity)) continue;
        const value = entity[field];
        const file = `ontology/seed/entities.json#/${index}`;
        if (typeof value !== "string" || !value.startsWith(prefix)) {
          issues.push({ file, message: `${field} must be an id starting with ${prefix}.` });
        } else if (!entityIds.has(value)) {
          issues.push({ file, message: `${field} ${value} does not match a seed entity.` });
        }
      }
    });
  } else if (entities !== null) {
    issues.push({ file: "ontology/seed/entities.json", message: "Seed entities must be an array." });
  }

  for (const type of ENTITY_TYPES) {
    if ((countByType.get(type) ?? 0) < 1) {
      issues.push({ file: "ontology/seed/entities.json", message: `No seed entity for ${type}.` });
    }
  }

  const edges = parseEdges(catalog, issues);
  const relationshipIds = new Set<string>();
  if (Array.isArray(relationships)) {
    relationships.forEach((relationship, index) => {
      const file = `ontology/seed/relationships.json#/${index}`;
      if (!isRecord(relationship)) {
        issues.push({ file, message: "Relationship seed must be an object." });
        return;
      }
      const { id, type, from, to } = relationship;
      if (typeof id !== "string" || typeof type !== "string" || typeof from !== "string" || typeof to !== "string") {
        issues.push({ file, message: "Relationship needs id, type, from, and to strings." });
        return;
      }
      if (relationshipIds.has(id)) issues.push({ file, message: `Duplicate relationship id ${id}.` });
      relationshipIds.add(id);
      if (!entityIds.has(from)) issues.push({ file, message: `Unknown entity id ${from}.` });
      if (!entityIds.has(to)) issues.push({ file, message: `Unknown entity id ${to}.` });
      const edge = edges.get(type);
      if (!edge) {
        issues.push({ file, message: `Relationship type ${type} is not declared in relationships.yaml.` });
        return;
      }
      const fromType = entityTypeFromId(from);
      const toType = entityTypeFromId(to);
      if (fromType !== edge.from || toType !== edge.to) {
        issues.push({
          file,
          message: `${type} must run from ${edge.from} to ${edge.to}, not ${fromType ?? "unknown"} to ${toType ?? "unknown"}.`,
        });
      }
    });
  } else if (relationships !== null) {
    issues.push({ file: "ontology/seed/relationships.json", message: "Seed relationships must be an array." });
  }

  const unitIds = new Set<string>();
  const parsedUnits: { file: string; data: Record<string, unknown> }[] = [];
  const unitFiles = walkUnits(root, issues);
  for (const file of unitFiles) {
    const data = readUnitData(root, file, validateUnit, issues);
    if (!data) continue;
    const id = typeof data.id === "string" ? data.id : "";
    const bucket = typeof data.bucket === "string" ? data.bucket : "";
    const expected = path.posix.join("units", bucket, id, "UNIT.md");
    if (id && bucket && file !== expected) issues.push({ file, message: `Path must be ${expected}.` });
    if (id) {
      if (unitIds.has(id)) issues.push({ file, message: `Duplicate unit id ${id}.` });
      unitIds.add(id);
    }
    if (Array.isArray(data.entities)) {
      for (const entityId of data.entities) {
        if (typeof entityId !== "string" || !entityIds.has(entityId)) {
          issues.push({ file, message: `Unknown entity id ${String(entityId)}.` });
        }
      }
    }
    if (typeof data.owner === "string" && !entityIds.has(data.owner)) {
      issues.push({ file, message: `Unknown owner ${data.owner}.` });
    }
    parsedUnits.push({ file, data });
  }

  for (const bucket of BUCKETS) {
    if (!unitFiles.some((file) => file.startsWith(`units/${bucket}/`))) {
      issues.push({ file: `units/${bucket}`, message: `Bucket ${bucket} has no units.` });
    }
  }

  for (const unit of parsedUnits) {
    const supersedes = unit.data.supersedes;
    if (typeof supersedes === "string") {
      if (supersedes === unit.data.id) issues.push({ file: unit.file, message: "A unit cannot supersede itself." });
      else if (!unitIds.has(supersedes)) issues.push({ file: unit.file, message: `supersedes unknown unit ${supersedes}.` });
    }
  }

  for (const file of walkComps(root, issues)) {
    const absolute = path.join(root, file);
    let data: Record<string, unknown> | null = null;
    try {
      data = parseFrontmatter(fs.readFileSync(absolute, "utf8")).data;
    } catch (error) {
      issues.push({ file, message: error instanceof Error ? error.message : "Invalid frontmatter." });
    }
    if (!data) continue;
    if (validateComp && !validateComp(data)) {
      for (const error of validateComp.errors ?? []) issues.push({ file, message: formatAjv(error) });
    }
    const id = typeof data.id === "string" ? data.id : "";
    if (id && file !== path.posix.join("comps", id, "COMP.md")) {
      issues.push({ file, message: `Path must be comps/${id}/COMP.md.` });
    }
    if (Array.isArray(data.units)) {
      for (const unitId of data.units) {
        if (typeof unitId !== "string" || !unitIds.has(unitId)) {
          issues.push({ file, message: `Unknown unit id ${String(unitId)}.` });
        }
      }
    }
    if (Array.isArray(data.entities)) {
      for (const entityId of data.entities) {
        if (typeof entityId !== "string" || !entityIds.has(entityId)) {
          issues.push({ file, message: `Unknown entity id ${String(entityId)}.` });
        }
      }
    }
    if (typeof data.owner === "string" && !entityIds.has(data.owner)) {
      issues.push({ file, message: `Unknown owner ${data.owner}.` });
    }
  }

  assertSeedSql(root, entityIds, relationshipIds, unitIds, issues);
  assertMigration(root, issues);
  scanDenylist(root, issues);
  return issues.sort((left, right) => left.file.localeCompare(right.file) || left.message.localeCompare(right.message));
}

export function validateUnitFile(
  file: string,
  options: { schema: AnySchemaObject; entityIds: Set<string> },
): Issue[] {
  const issues: Issue[] = [];
  const markdown = fs.readFileSync(file, "utf8");
  for (const term of deniedTerms(markdown)) {
    issues.push({ file, message: `Denied term ${term}.` });
  }
  let data: Record<string, unknown>;
  try {
    data = parseFrontmatter(markdown).data;
  } catch (error) {
    issues.push({ file, message: error instanceof Error ? error.message : "Invalid frontmatter." });
    return issues;
  }
  const validate = new Ajv({ allErrors: true, strict: false }).compile(options.schema);
  if (!validate(data)) {
    for (const error of validate.errors ?? []) issues.push({ file, message: formatAjv(error) });
  }
  if (Array.isArray(data.entities)) {
    for (const entityId of data.entities) {
      if (typeof entityId !== "string" || !options.entityIds.has(entityId)) {
        issues.push({ file, message: `Unknown entity id ${String(entityId)}.` });
      }
    }
  }
  return issues;
}

function assertSeedSql(
  root: string,
  entityIds: Set<string>,
  relationshipIds: Set<string>,
  unitIds: Set<string>,
  issues: Issue[],
) {
  const relative = "supabase/seed_entities.sql";
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) {
    issues.push({ file: relative, message: "Missing entity seed SQL." });
    return;
  }
  const sql = fs.readFileSync(absolute, "utf8");
  for (const id of entityIds) {
    if (!sql.includes(`'${id}'`)) issues.push({ file: relative, message: `Missing seed id ${id}.` });
  }
  for (const id of relationshipIds) {
    if (!sql.includes(`'${id}'`)) issues.push({ file: relative, message: `Missing relationship id ${id}.` });
  }
  for (const id of unitIds) {
    if (!sql.includes(`'${id}'`)) issues.push({ file: relative, message: `Missing unit ref ${id}.` });
  }
  if (/\bcreate table\b[\s\S]*\btranscripts\b/i.test(sql) || /payload_storage_path/.test(sql)) {
    issues.push({ file: relative, message: "Seed SQL must not store transcripts." });
  }
}

function assertMigration(root: string, issues: Issue[]) {
  const relative = "supabase/migrations/20261123120000_entities.sql";
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) {
    issues.push({ file: relative, message: "Missing entities migration." });
    return;
  }
  const sql = fs.readFileSync(absolute, "utf8");
  if (!/create table public\.unit_refs/i.test(sql) || !/\brepo_path\b/.test(sql) || !/\bcommit_sha\b/.test(sql)) {
    issues.push({ file: relative, message: "unit_refs must store repo_path and commit_sha." });
  }
  if (/create table public\.transcripts/i.test(sql)) {
    issues.push({ file: relative, message: "The entities migration must not store transcripts." });
  }
}

function scanDenylist(root: string, issues: Issue[]) {
  for (const relative of DENYLIST_ROOTS) {
    const absolute = path.join(root, relative);
    if (!fs.existsSync(absolute)) continue;
    const stat = fs.statSync(absolute);
    const files = stat.isDirectory() ? walkTextFiles(absolute, root) : [relative];
    for (const file of files) {
      if (DENYLIST_SKIP.has(path.normalize(file))) continue;
      const text = fs.readFileSync(path.join(root, file), "utf8");
      for (const term of deniedTerms(text)) issues.push({ file, message: `Denied term ${term}.` });
    }
  }
}

function walkTextFiles(directory: string, root: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "index.json") continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkTextFiles(absolute, root));
    else if (TEXT_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(path.relative(root, absolute).split(path.sep).join("/"));
    }
  }
  return files;
}

function walkUnits(root: string, issues: Issue[]): string[] {
  const unitsRoot = path.join(root, "units");
  if (!fs.existsSync(unitsRoot)) {
    issues.push({ file: "units", message: "Missing units directory." });
    return [];
  }
  const files: string[] = [];
  for (const entry of fs.readdirSync(unitsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (!BUCKETS.includes(entry.name as (typeof BUCKETS)[number])) {
      issues.push({ file: `units/${entry.name}`, message: `Unknown bucket ${entry.name}.` });
      continue;
    }
    const bucketDir = path.join(unitsRoot, entry.name);
    for (const unitId of fs.readdirSync(bucketDir, { withFileTypes: true })) {
      if (!unitId.isDirectory()) {
        issues.push({ file: `units/${entry.name}/${unitId.name}`, message: "Unit folders must contain UNIT.md." });
        continue;
      }
      const relative = path.posix.join("units", entry.name, unitId.name, "UNIT.md");
      if (!fs.existsSync(path.join(root, relative))) {
        issues.push({ file: `units/${entry.name}/${unitId.name}`, message: "Missing UNIT.md." });
        continue;
      }
      files.push(relative);
    }
  }
  return files;
}

function walkComps(root: string, issues: Issue[]): string[] {
  const compsRoot = path.join(root, "comps");
  if (!fs.existsSync(compsRoot)) {
    issues.push({ file: "comps", message: "Missing comps directory." });
    return [];
  }
  const files: string[] = [];
  for (const entry of fs.readdirSync(compsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const relative = path.posix.join("comps", entry.name, "COMP.md");
    if (!fs.existsSync(path.join(root, relative))) {
      issues.push({ file: `comps/${entry.name}`, message: "Missing COMP.md." });
      continue;
    }
    files.push(relative);
  }
  return files;
}

function readUnitData(
  root: string,
  file: string,
  validateUnit: ValidateFunction | null,
  issues: Issue[],
): Record<string, unknown> | null {
  try {
    const data = parseFrontmatter(fs.readFileSync(path.join(root, file), "utf8")).data;
    if (validateUnit && !validateUnit(data)) {
      for (const error of validateUnit.errors ?? []) issues.push({ file, message: formatAjv(error) });
    }
    return data;
  } catch (error) {
    issues.push({ file, message: error instanceof Error ? error.message : "Invalid frontmatter." });
    return null;
  }
}

function loadEntitySchemas(root: string, ajv: Ajv, issues: Issue[]): Map<string, ValidateFunction> {
  const directory = path.join(root, "ontology/entities");
  const schemas = new Map<string, ValidateFunction>();
  if (!fs.existsSync(directory)) {
    issues.push({ file: "ontology/entities", message: "Missing ontology directory." });
    return schemas;
  }
  for (const name of fs.readdirSync(directory)) {
    const file = `ontology/entities/${name}`;
    if (!name.endsWith(".schema.json")) {
      issues.push({ file, message: "Unexpected file in ontology/entities." });
      continue;
    }
    const type = name.slice(0, -".schema.json".length);
    if (!ENTITY_TYPES.includes(type as EntityType)) {
      issues.push({ file, message: `Unknown entity type ${type}.` });
      continue;
    }
    const schema = readJson(root, file, issues);
    if (!isRecord(schema)) continue;
    checkDeclaration(file, schema, issues);
    schemas.set(type, ajv.compile(schema));
  }
  for (const type of ENTITY_TYPES) {
    if (!schemas.has(type)) issues.push({ file: `ontology/entities/${type}.schema.json`, message: "Missing entity schema." });
  }
  return schemas;
}

function checkDeclaration(file: string, schema: Record<string, unknown>, issues: Issue[]) {
  const source = schema["x-source-of-truth"];
  const mirror = schema["x-mirror-direction"];
  const note = schema["x-mirror-note"];
  if (source !== "git" && source !== "db" && source !== "both") {
    issues.push({ file, message: "x-source-of-truth must be git, db, or both." });
  }
  if (mirror !== "git_to_db" && mirror !== "db_to_git") {
    issues.push({ file, message: "x-mirror-direction must be git_to_db or db_to_git." });
  }
  if (source === "git" && mirror !== "git_to_db") issues.push({ file, message: "A git source mirrors git_to_db." });
  if (source === "db" && mirror !== "db_to_git") issues.push({ file, message: "A db source mirrors db_to_git." });
  if (typeof note !== "string" || note.trim() === "") {
    issues.push({ file, message: "x-mirror-note must explain the one-way mirror." });
  }
}

function parseEdges(catalog: unknown, issues: Issue[]): Map<string, Edge> {
  const edges = new Map<string, Edge>();
  const file = "ontology/relationships.yaml";
  if (!isRecord(catalog)) {
    if (catalog !== null) issues.push({ file, message: "Catalog must be a mapping." });
    return edges;
  }
  if (catalog.source_of_truth !== "db") issues.push({ file, message: "Relationship rows use db as the source of truth." });
  if (catalog.mirror_direction !== "db_to_git") issues.push({ file, message: "Relationship mirror direction must be db_to_git." });
  if (typeof catalog.mirror_note !== "string" || catalog.mirror_note.trim() === "") {
    issues.push({ file, message: "Relationship catalog needs a mirror note." });
  }
  if (!Array.isArray(catalog.edges)) {
    issues.push({ file, message: "edges must be a list." });
    return edges;
  }
  catalog.edges.forEach((edge, index) => {
    if (!isRecord(edge) || typeof edge.type !== "string" || typeof edge.from !== "string" || typeof edge.to !== "string") {
      issues.push({ file, message: `Edge ${index} needs type, from, and to.` });
      return;
    }
    if (typeof edge.description !== "string" || edge.description.trim() === "") {
      issues.push({ file, message: `Edge ${edge.type} needs a description.` });
    }
    if (!ENTITY_TYPES.includes(edge.from as EntityType) || !ENTITY_TYPES.includes(edge.to as EntityType)) {
      issues.push({ file, message: `Edge ${edge.type} must connect known entity types.` });
    }
    if (edges.has(edge.type)) issues.push({ file, message: `Duplicate edge type ${edge.type}.` });
    edges.set(edge.type, { type: edge.type, from: edge.from, to: edge.to });
  });
  return edges;
}

function compile(ajv: Ajv, schema: unknown): ValidateFunction | null {
  if (!isRecord(schema)) return null;
  return ajv.compile(schema);
}

function readJson(root: string, relative: string, issues: Issue[]): unknown {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) {
    issues.push({ file: relative, message: "Missing file." });
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(absolute, "utf8")) as unknown;
  } catch (error) {
    issues.push({ file: relative, message: error instanceof Error ? error.message : "Invalid JSON." });
    return null;
  }
}

function readYaml(root: string, relative: string, issues: Issue[]): unknown {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) {
    issues.push({ file: relative, message: "Missing file." });
    return null;
  }
  try {
    return parse(fs.readFileSync(absolute, "utf8")) as unknown;
  } catch (error) {
    issues.push({ file: relative, message: error instanceof Error ? error.message : "Invalid YAML." });
    return null;
  }
}

function formatAjv(error: ErrorObject): string {
  const where = error.instancePath || "/";
  return `${where} ${error.message ?? "is invalid"}`.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
