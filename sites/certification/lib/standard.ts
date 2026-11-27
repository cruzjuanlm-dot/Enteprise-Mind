import fs from "node:fs";
import path from "node:path";
import { site } from "./site";

export type StandardSection = {
  id: string;
  title: string;
  version: string;
  status: string;
  body: string;
};

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;

function readField(block: string, key: string): string {
  const match = new RegExp(`^${key}:\\s*"?([^"\\n]+)"?\\s*$`, "m").exec(block);
  return match?.[1]?.trim() ?? "";
}

export function loadStandard(): StandardSection[] {
  const directory = path.join(process.cwd(), "content", "standard");
  const files = fs
    .readdirSync(directory)
    .filter((name) => name.endsWith(".md"))
    .sort();
  return files.map((file) => {
    const raw = fs.readFileSync(path.join(directory, file), "utf8");
    const match = FRONTMATTER.exec(raw);
    if (!match?.[1] || match[2] === undefined) {
      throw new Error(`${file} is missing frontmatter.`);
    }
    const section: StandardSection = {
      id: readField(match[1], "id"),
      title: readField(match[1], "title"),
      version: readField(match[1], "version"),
      status: readField(match[1], "status"),
      body: match[2].trim(),
    };
    if (!section.id || !section.title) {
      throw new Error(`${file} needs an id and a title.`);
    }
    return section;
  });
}

export function standardIssues(sections: StandardSection[] = loadStandard()): string[] {
  const issues: string[] = [];
  if (sections.length === 0) issues.push("The standard has no sections.");
  for (const section of sections) {
    if (section.version !== site.version) {
      issues.push(`${section.id} is version ${section.version}, not ${site.version}.`);
    }
    if (section.status !== site.status) {
      issues.push(`${section.id} is ${section.status}, not ${site.status}.`);
    }
  }
  const history = sections.find((section) => section.id === "history");
  if (!history) issues.push("Version history section is missing.");
  if (history && !history.body.includes("2026-11-26")) {
    issues.push("Version history does not name 2026-11-26.");
  }
  return issues;
}
