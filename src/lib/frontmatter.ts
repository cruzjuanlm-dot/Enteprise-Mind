import { parse } from "yaml";

export const BUCKETS = ["architecture", "design", "conversations", "decisions", "procedures"] as const;
export type Bucket = (typeof BUCKETS)[number];

export const BUCKET_LABEL: Record<Bucket, string> = {
  architecture: "Architecture",
  design: "Design",
  conversations: "Conversations",
  decisions: "Decisions",
  procedures: "Procedures",
};

export const BUCKET_BLURB: Record<Bucket, string> = {
  architecture: "How systems are split and how they connect.",
  design: "Screens and structures a person uses.",
  conversations: "Written summaries. Spoken audio is not stored.",
  decisions: "Choices that govern later work.",
  procedures: "SOPs, trainings, and workflow how-tos.",
};

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
