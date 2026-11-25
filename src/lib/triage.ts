import fs from "node:fs";
import path from "node:path";

const HEADER = `# Triage

Claims that were extracted and did not become a knowledge unit.
Append one bullet per claim. Do not paste transcript text.

`;

export type TriageClaim = {
  projectId: string;
  sourceId: string;
  kind: string;
  title: string;
};

/**
 * File record for solenoidal continuity.
 * TODO: mirror these bullets into a database table when a triage relation exists.
 * That table must store the same fields and must not store transcript text.
 */
export function appendTriage(root: string, claims: TriageClaim[]): void {
  if (claims.length === 0) return;
  const file = path.join(root, "_control/triage.md");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const existing = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : HEADER;
  const lines = claims
    .map((claim) => `- ${claim.projectId} ${claim.sourceId} ${claim.kind} ${claim.title}`)
    .filter((line) => !existing.includes(line));
  if (lines.length === 0) return;
  const next = existing.endsWith("\n") ? existing : `${existing}\n`;
  fs.writeFileSync(file, `${next}${lines.join("\n")}\n`);
}
