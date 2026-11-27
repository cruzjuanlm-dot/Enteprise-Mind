import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { containsTranscript, validateUnitFile } from "../src/lib/validate-content";
import { unitPins } from "../src/lib/unit-pin";
import type { UnitIndexEntry } from "../src/lib/unit-index";

const root = path.resolve(import.meta.dirname, "..");

test("a company unit needs a domain and a requirement needs acceptance", () => {
  const schema = JSON.parse(fs.readFileSync(path.join(root, "ontology/schemas/unit.schema.json"), "utf8"));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "flux-domain-"));
  const file = path.join(dir, "UNIT.md");
  fs.writeFileSync(
    file,
    `---
id: kilnwatch-seed-DEC-099
title: Company note
type: DEC
scope: company
project: project.kilnwatch
source_id: source.seed
version: 1
status: accepted
owner: person-role.catalog-editor
entities: []
supersedes: null
---

A company note without a route.
`,
  );
  const issues = validateUnitFile(file, { schema, entityIds: new Set(["person-role.catalog-editor"]) });
  assert.ok(issues.some((issue) => issue.message === "scope company requires domain."));

  fs.writeFileSync(
    file,
    `---
id: kilnwatch-seed-REQ-099
title: A requirement
type: REQ
scope: project
project: project.kilnwatch
source_id: source.seed
version: 1
status: accepted
owner: person-role.catalog-editor
entities: []
supersedes: null
---

Missing acceptance.
`,
  );
  const requirement = validateUnitFile(file, { schema, entityIds: new Set(["person-role.catalog-editor"]) });
  assert.ok(requirement.some((issue) => issue.message === "REQ requires acceptance_criteria."));
});

test("speaker turns and caption files count as a transcript", () => {
  assert.equal(containsTranscript("The curve id is the record."), false);
  assert.equal(containsTranscript("WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello"), true);
  assert.equal(containsTranscript("Avery: Keep the curve.\nBlair: Agreed."), true);
  assert.equal(containsTranscript("owner: person-role.catalog-editor"), false);
});

test("commit pins follow changed unit paths", () => {
  const units = [
    { id: "kilnwatch-seed-DEC-001", path: "projects/kilnwatch/units/kilnwatch-seed-DEC-001.md" },
    { id: "kilnwatch-seed-WF-001", path: "projects/kilnwatch/units/kilnwatch-seed-WF-001.md" },
  ] as UnitIndexEntry[];
  const pins = unitPins(units, ["projects/kilnwatch/units/kilnwatch-seed-DEC-001.md", "README.md"], "abc1234");
  assert.deepEqual(pins, [
    {
      id: "kilnwatch-seed-DEC-001",
      unit_path: "projects/kilnwatch/units/kilnwatch-seed-DEC-001.md",
      commit_sha: "abc1234",
    },
  ]);
  assert.deepEqual(unitPins(units, units.map((unit) => unit.path), "nope"), []);
});

test("a composition may name an action item", () => {
  const schema = JSON.parse(fs.readFileSync(path.join(root, "ontology/schemas/comp.schema.json"), "utf8"));
  const pattern = schema.properties.entities.items.pattern as string;
  assert.match("action-item.publish-bench-checklist", new RegExp(pattern));
  assert.deepEqual(schema.properties.capabilities.items.properties.kind.enum, ["agent", "mcp", "deck", "course"]);
});
