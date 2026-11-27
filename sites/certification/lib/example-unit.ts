import fs from "node:fs";
import path from "node:path";
import { UNIT_SOURCE_PATH } from "./hearthline";

export type ExampleUnit = {
  sourcePath: string;
  raw: string;
  frontmatter: string;
  body: string;
};

export function vendoredUnitPath(): string {
  return path.join(process.cwd(), "content", "example", "kilnwatch-seed-DEC-001.md");
}

export function repositoryUnitPath(): string {
  return path.join(process.cwd(), "..", "..", UNIT_SOURCE_PATH);
}

export function loadExampleUnit(): ExampleUnit {
  const raw = fs.readFileSync(vendoredUnitPath(), "utf8");
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
  if (!match?.[1] || match[2] === undefined) {
    throw new Error("Example unit is missing frontmatter.");
  }
  return {
    sourcePath: UNIT_SOURCE_PATH,
    raw,
    frontmatter: match[1].trim(),
    body: match[2].trim(),
  };
}
