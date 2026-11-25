import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { deniedTerms } from "../src/lib/denylist";
import { loadEntities } from "../src/lib/entity-read";
import { BUCKETS } from "../src/lib/frontmatter";
import { loadDeclarations } from "../src/lib/ontology";
import { collectUnits } from "../src/lib/unit-index";
import { validateRepository, validateUnitFile } from "../src/lib/validate-content";

const root = path.resolve(import.meta.dirname, "..");

test("denied terms match the company names and skip the word field", () => {
  assert.deepEqual(deniedTerms("field notes for a kiln"), []);
  assert.deepEqual(deniedTerms("a ring of clay"), []);
  assert.deepEqual(deniedTerms("Feld Entertainment"), ["Feld"]);
  assert.deepEqual(deniedTerms("Ringling"), ["Ringling"]);
  assert.deepEqual(deniedTerms("a disney catalog"), ["Disney"]);
  assert.deepEqual(deniedTerms("a TicketCel booth"), ["Ticketcel"]);
  assert.deepEqual(deniedTerms("the cirque tent"), ["Cirque"]);
});

test("validator rejects a bad unit fixture", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "flux-unit-"));
  const bad = path.join(dir, "UNIT.md");
  fs.writeFileSync(
    bad,
    `---
id: bad-example
title: Bad example
bucket: decisions
version: 1
status: accepted
owner: person-role.catalog-editor
entities:
  - system.missing
supersedes: null
---

field notes stay allowed.
Feld Entertainment is not part of this catalog.
`,
  );
  const schema = JSON.parse(fs.readFileSync(path.join(root, "schema/unit.schema.json"), "utf8"));
  const issues = validateUnitFile(bad, {
    schema,
    entityIds: new Set(["person-role.catalog-editor"]),
  });
  assert.ok(issues.some((issue) => issue.message === "Denied term Feld."));
  assert.ok(issues.some((issue) => issue.message === "Unknown entity id system.missing."));
  assert.equal(issues.filter((issue) => issue.message.startsWith("Denied term")).length, 1);

  const invalid = path.join(dir, "invalid.md");
  fs.writeFileSync(
    invalid,
    `---
id: bad-example
title: Bad example
bucket: decisions
version: 1
status: nope
owner: person-role.catalog-editor
entities: []
supersedes: null
---

Clean body.
`,
  );
  const schemaIssues = validateUnitFile(invalid, { schema, entityIds: new Set(["person-role.catalog-editor"]) });
  assert.ok(schemaIssues.some((issue) => issue.message.includes("status")));
});

test("the Hearthline catalog validates and covers every bucket", () => {
  const issues = validateRepository(root);
  assert.deepEqual(issues, []);
  const units = collectUnits(root);
  assert.deepEqual(
    BUCKETS.map((bucket) => units.filter((unit) => unit.bucket === bucket).length),
    BUCKETS.map(() => 1),
  );
});

test("entity source of truth is the schema declaration", () => {
  assert.deepEqual(
    loadDeclarations(root).map((declaration) => ({
      type: declaration.type,
      sourceOfTruth: declaration.sourceOfTruth,
      mirrorDirection: declaration.mirrorDirection,
    })),
    [
      { type: "system", sourceOfTruth: "both", mirrorDirection: "git_to_db" },
      { type: "environment", sourceOfTruth: "db", mirrorDirection: "db_to_git" },
      { type: "data_source", sourceOfTruth: "db", mirrorDirection: "db_to_git" },
      { type: "table_schema", sourceOfTruth: "git", mirrorDirection: "git_to_db" },
      { type: "integration", sourceOfTruth: "db", mirrorDirection: "db_to_git" },
      { type: "workflow", sourceOfTruth: "both", mirrorDirection: "git_to_db" },
      { type: "project", sourceOfTruth: "both", mirrorDirection: "git_to_db" },
      { type: "requirement", sourceOfTruth: "git", mirrorDirection: "git_to_db" },
      { type: "use_case", sourceOfTruth: "git", mirrorDirection: "git_to_db" },
      { type: "test_case", sourceOfTruth: "both", mirrorDirection: "git_to_db" },
      { type: "milestone", sourceOfTruth: "db", mirrorDirection: "db_to_git" },
      { type: "decision", sourceOfTruth: "git", mirrorDirection: "git_to_db" },
      { type: "person_role", sourceOfTruth: "db", mirrorDirection: "db_to_git" },
      { type: "action_item", sourceOfTruth: "db", mirrorDirection: "db_to_git" },
    ],
  );
});

test("entities fall back to seed JSON when Supabase is unset or unreadable", async () => {
  const missing = await loadEntities({
    root,
    env: { NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "" },
  });
  assert.equal(missing.source, "seed");
  assert.ok(missing.entities.some((entity) => entity.id === "system.kiln-ledger"));

  const failed = await loadEntities({
    root,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://hearthline.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-anon-test",
    },
    readSupabase: async () => {
      throw new Error("paused");
    },
  });
  assert.equal(failed.source, "seed");
  assert.match(failed.note ?? "", /committed seed/);
  assert.match(failed.note ?? "", /paused/);
});

test("catalog pages are static and do not read the session", () => {
  const unitPage = fs.readFileSync(
    path.join(root, "src/app/(catalog)/catalog/[bucket]/[id]/page.tsx"),
    "utf8",
  );
  const catalogPage = fs.readFileSync(path.join(root, "src/app/(catalog)/catalog/page.tsx"), "utf8");
  assert.match(unitPage, /force-static/);
  assert.match(catalogPage, /force-static/);
  assert.doesNotMatch(unitPage, /getContext|cookies\(/);
  assert.doesNotMatch(catalogPage, /getContext|cookies\(/);
});
