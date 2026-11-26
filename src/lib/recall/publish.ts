import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { stringify } from "yaml";
import { nextUnitId, unitRelativePath, type TypeCode } from "../frontmatter";
import { appendTriage, type TriageClaim } from "../triage";
import { writeUnitIndex } from "../unit-index";
import { githubToken } from "./config";
import { RecallError } from "./errors";
import type { MeetingNote, UnresolvedClaim } from "./transcript";
import { roleIdForOwner } from "./transcript";

export type PublishedNote = {
  id: string;
  name: string;
  summary: string;
  ownerRoleId: string | null;
};

export type PublishResult = {
  mode: "working_tree" | "pull_request";
  note: string;
  pullRequestUrl: string | null;
  conversationPath: string;
  decisionPath: string | null;
  conversationId: string;
  decisionUnitId: string | null;
  actions: PublishedNote[];
  decisions: PublishedNote[];
};

type CatalogEntity = {
  id: string;
  type: string;
  name: string;
  summary: string;
  project_id?: string;
  state?: string;
  owner_role_id?: string;
};

type ResolvedNote = PublishedNote & { created: boolean };

const OWNER = "person-role.catalog-editor";

export async function publishMeetingUnits(input: {
  root: string;
  env: NodeJS.ProcessEnv;
  fetch: typeof fetch;
  meetingTitle: string;
  hash: string;
  segmentCount: number;
  projectId: string;
  actions: MeetingNote[];
  decisions: MeetingNote[];
  unresolved: UnresolvedClaim[];
}): Promise<PublishResult> {
  const suffix = input.hash.slice(0, 8);
  const actions = input.actions.map((note) => catalogNote(input.root, "action_item", note, input.projectId));
  const decisions = input.decisions.map((note) => catalogNote(input.root, "decision", note, input.projectId));
  for (const decision of decisions) {
    if (!decision.created) continue;
    addRelationship(input.root, {
      id: `rel.governs.${slugify(decision.name)}`,
      type: "governs",
      fromType: "decision",
      fromId: decision.id,
      toType: "project",
      toId: input.projectId,
    });
  }
  for (const action of actions) {
    if (!action.created) continue;
    if (action.ownerRoleId) {
      addRelationship(input.root, {
        id: `rel.assigns.${slugify(action.name)}`,
        type: "assigns",
        fromType: "action_item",
        fromId: action.id,
        toType: "person_role",
        toId: action.ownerRoleId,
      });
    }
    if (decisions[0]) {
      addRelationship(input.root, {
        id: `rel.follows.${slugify(action.name)}`,
        type: "follows",
        fromType: "action_item",
        fromId: action.id,
        toType: "decision",
        toId: decisions[0].id,
      });
    }
  }
  const sourceShort = `mtg${suffix}`;
  const sourceId = `source.${sourceShort}`;
  const summaryType: TypeCode = input.unresolved.length > 0 ? "OQ" : "BR";
  const existingIds = listUnitIds(input.root, input.projectId);
  const conversationId = nextUnitId(existingIds, input.projectId, sourceShort, summaryType);
  existingIds.push(conversationId);
  const decisionUnits = decisions.map((note) => {
    const id = nextUnitId(existingIds, input.projectId, sourceShort, "DEC");
    existingIds.push(id);
    return { note, id, path: unitRelativePath(input.projectId, id) };
  });
  const decisionUnitId = decisionUnits[0]?.id ?? null;
  const conversationPath = unitRelativePath(input.projectId, conversationId);
  const decisionPath = decisionUnits[0]?.path ?? null;
  const conversationEntities = unique([
    input.projectId,
    ...decisions.map((note) => note.id),
    ...actions.map((note) => note.id),
    OWNER,
  ]);

  const files = new Map<string, string>();
  files.set(
    conversationPath,
    renderUnit({
      id: conversationId,
      title: input.meetingTitle,
      type: summaryType,
      projectId: input.projectId,
      sourceId,
      entities: conversationEntities,
      body: conversationBody(input.meetingTitle, actions, decisions, input.segmentCount),
    }),
  );
  for (const decision of decisionUnits) {
    files.set(
      decision.path,
      renderUnit({
        id: decision.id,
        title: decision.note.name,
        type: "DEC",
        projectId: input.projectId,
        sourceId,
        entities: unique([input.projectId, decision.note.id, OWNER]),
        body: decisionBody([decision.note]),
      }),
    );
  }
  for (const [relative, content] of files) {
    writeRepoFile(input.root, relative, content);
  }
  const triageClaims: TriageClaim[] = input.unresolved.map((claim) => ({
    projectId: input.projectId,
    sourceId,
    kind: claim.kind,
    title: claim.title,
  }));
  appendTriage(input.root, triageClaims);
  rememberUnits(input.root, [
    {
      id: conversationId,
      unitType: summaryType,
      projectId: input.projectId,
      sourceId,
      title: input.meetingTitle,
      repoPath: conversationPath,
      entityIds: conversationEntities,
    },
    ...decisionUnits.map((decision) => ({
      id: decision.id,
      unitType: "DEC" as const,
      projectId: input.projectId,
      sourceId,
      title: decision.note.name,
      repoPath: decision.path,
      entityIds: unique([input.projectId, decision.note.id, OWNER]),
    })),
  ]);
  writeUnitIndex(input.root);

  const token = githubToken(input.env);
  const base = {
    conversationPath,
    decisionPath,
    conversationId,
    decisionUnitId,
    actions,
    decisions,
  };
  if (!token) {
    return {
      ...base,
      mode: "working_tree",
      pullRequestUrl: null,
      note: "GITHUB_TOKEN and FLUX_GITHUB_TOKEN are unset, so the units were written to the working tree. Set one of them to open a draft pull request.",
    };
  }
  const repository = repositorySlug(input.env, input.root);
  if (!repository) {
    return {
      ...base,
      mode: "working_tree",
      pullRequestUrl: null,
      note: "A GitHub token is set, but GITHUB_REPOSITORY is unset and the origin remote is not a GitHub repository, so the units were written to the working tree and no pull request was opened.",
    };
  }
  const url = await openDraftPullRequest({
    fetch: input.fetch,
    token,
    repository,
    base: input.env.GITHUB_BASE_REF?.trim() || "main",
    branch: `flux/meeting-${suffix}`,
    title: `Draft meeting notes: ${input.meetingTitle}`,
    body: "Rule-based meeting notes. The transcript text was discarded. This pull request stores the summary units only.",
    files,
    root: input.root,
  });
  return {
    ...base,
    mode: "pull_request",
    pullRequestUrl: url,
    note: "Opened a draft pull request.",
  };
}

export function repositorySlug(env: NodeJS.ProcessEnv, cwd: string): string {
  const explicit = env.GITHUB_REPOSITORY?.trim() ?? "";
  if (/^[\w.-]+\/[\w.-]+$/.test(explicit)) return explicit;
  try {
    const remote = execFileSync("git", ["remote", "get-url", "origin"], { cwd, encoding: "utf8" }).trim();
    const match = /github\.com[:/]([\w.-]+\/[\w.-]+?)(?:\.git)?$/.exec(remote);
    return match?.[1] ?? "";
  } catch {
    return "";
  }
}

function catalogNote(root: string, type: "action_item" | "decision", note: MeetingNote, projectId: string): ResolvedNote {
  const entities = readEntities(root);
  const existing = entities.find(
    (entity) => entity.type === type && entity.name.toLowerCase() === note.title.toLowerCase(),
  );
  const ownerRoleId = roleIdForOwner(note.ownerName);
  if (existing) {
    return { id: existing.id, name: existing.name, summary: existing.summary, ownerRoleId, created: false };
  }
  const prefix = type === "action_item" ? "action-item" : "decision";
  const id = `${prefix}.${slugify(note.title)}`;
  const entity: CatalogEntity = {
    id,
    type,
    name: note.title,
    summary: note.title,
    project_id: projectId,
    state: type === "action_item" ? "open" : "proposed",
    ...(ownerRoleId ? { owner_role_id: ownerRoleId } : {}),
  };
  entities.push(entity);
  fs.writeFileSync(path.join(root, "ontology/seed/entities.json"), `${JSON.stringify(entities, null, 2)}\n`);
  appendSeed(root, entityInsert(entity), `'${entity.id}'`);
  return { id, name: note.title, summary: note.title, ownerRoleId, created: true };
}

function addRelationship(
  root: string,
  relationship: { id: string; type: string; fromType: string; fromId: string; toType: string; toId: string },
): void {
  const file = path.join(root, "ontology/seed/relationships.json");
  const relationships = JSON.parse(fs.readFileSync(file, "utf8")) as { id: string; type: string; from: string; to: string }[];
  if (!relationships.some((item) => item.id === relationship.id)) {
    relationships.push({
      id: relationship.id,
      type: relationship.type,
      from: relationship.fromId,
      to: relationship.toId,
    });
    fs.writeFileSync(file, `${JSON.stringify(relationships, null, 2)}\n`);
  }
  appendSeed(
    root,
    `insert into public.entity_relationships (id, relationship_type, from_type, from_id, to_type, to_id) values (${sql(relationship.id)}, ${sql(relationship.type)}, ${sql(relationship.fromType)}, ${sql(relationship.fromId)}, ${sql(relationship.toType)}, ${sql(relationship.toId)}) on conflict (id) do nothing;`,
    `'${relationship.id}'`,
  );
}

function entityInsert(entity: CatalogEntity): string {
  if (entity.type === "action_item") {
    return `insert into public.action_items (id, name, summary, project_id, owner_role_id, state) values (${sql(entity.id)}, ${sql(entity.name)}, ${sql(entity.summary)}, ${sql(entity.project_id ?? "")}, ${entity.owner_role_id ? sql(entity.owner_role_id) : "null"}, ${sql(entity.state ?? "open")}) on conflict (id) do nothing;`;
  }
  return `insert into public.decisions (id, name, summary, project_id, state) values (${sql(entity.id)}, ${sql(entity.name)}, ${sql(entity.summary)}, ${sql(entity.project_id ?? "")}, ${sql(entity.state ?? "proposed")}) on conflict (id) do nothing;`;
}

function listUnitIds(root: string, projectId: string): string[] {
  const slug = projectId.startsWith("project.") ? projectId.slice("project.".length) : projectId;
  const directory = path.join(root, "projects", slug, "units");
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory)
    .filter((name) => name.endsWith(".md"))
    .map((name) => name.slice(0, -".md".length));
}

function rememberUnits(
  root: string,
  units: {
    id: string;
    unitType: TypeCode;
    projectId: string;
    sourceId: string;
    title: string;
    repoPath: string;
    entityIds: string[];
  }[],
): void {
  for (const unit of units) {
    const ref = `insert into public.unit_refs (id, unit_type, scope, project_id, source_id, title, version, status, owner, repo_path, commit_sha, supersedes) values (${sql(unit.id)}, ${sql(unit.unitType)}, 'project', ${sql(unit.projectId)}, ${sql(unit.sourceId)}, ${sql(unit.title)}, 1, 'draft', ${sql(OWNER)}, ${sql(unit.repoPath)}, null, null) on conflict (id) do nothing;`;
    const links = unit.entityIds.map(
      (entityId) =>
        `insert into public.unit_ref_entities (unit_id, entity_id) values (${sql(unit.id)}, ${sql(entityId)}) on conflict (unit_id, entity_id) do nothing;`,
    );
    appendSeed(root, [ref, ...links].join("\n"), `'${unit.id}'`);
  }
}

function appendSeed(root: string, fragment: string, key: string): void {
  const relative = path.join(root, "supabase/seed_entities.sql");
  if (!fs.existsSync(relative)) return;
  const sqlText = fs.readFileSync(relative, "utf8");
  if (sqlText.includes(key)) return;
  const commitAt = sqlText.lastIndexOf("\ncommit;");
  const next = commitAt === -1 ? `${sqlText.trimEnd()}\n\n${fragment}\n` : `${sqlText.slice(0, commitAt)}\n${fragment}${sqlText.slice(commitAt)}`;
  fs.writeFileSync(relative, next.endsWith("\n") ? next : `${next}\n`);
}

function renderUnit(input: {
  id: string;
  title: string;
  type: TypeCode;
  projectId: string;
  sourceId: string;
  entities: string[];
  body: string;
}): string {
  const front = stringify(
    {
      id: input.id,
      title: input.title,
      type: input.type,
      scope: "project",
      project: input.projectId,
      source_id: input.sourceId,
      version: 1,
      status: "draft",
      owner: OWNER,
      entities: input.entities,
      supersedes: null,
    },
    { lineWidth: 0 },
  ).trimEnd();
  return `---\n${front}\n---\n\n${input.body.trim()}\n`;
}

function conversationBody(title: string, actions: PublishedNote[], decisions: PublishedNote[], segmentCount: number): string {
  return [
    "## Summary",
    "",
    `${title} produced ${decisions.length} ${decisions.length === 1 ? "decision" : "decisions"} and ${actions.length} ${actions.length === 1 ? "action item" : "action items"}. ${segmentCount} transcript segments were counted and then discarded.`,
    "",
    "## Links",
    "",
    ...decisions.map((note) => `- Decision: ${note.id}`),
    ...actions.map((note) => `- Action: ${note.id}`),
    "",
    "## What was not kept",
    "",
    "The spoken transcript is not in this file. The artifact row keeps a hash, the segment count, and speaker labels.",
  ].join("\n");
}

function decisionBody(decisions: PublishedNote[]): string {
  return [
    "## Decision",
    "",
    ...decisions.map((note) => note.name),
    "",
    "## Consequence",
    "",
    "This file is the governed summary. The transcript it was drawn from was discarded after extraction.",
  ].join("\n");
}

async function openDraftPullRequest(input: {
  fetch: typeof fetch;
  token: string;
  repository: string;
  base: string;
  branch: string;
  title: string;
  body: string;
  files: Map<string, string>;
  root: string;
}): Promise<string> {
  const baseRef = await github(input, `/repos/${input.repository}/git/ref/heads/${input.base}`);
  if (!baseRef.ok) throw new RecallError("github_request_failed", 502);
  const baseBody = (await baseRef.json()) as { object?: { sha?: string } };
  const baseSha = baseBody.object?.sha;
  if (!baseSha) throw new RecallError("github_request_failed", 502);

  const existing = await github(input, `/repos/${input.repository}/git/ref/heads/${input.branch}`);
  if (existing.ok) {
    const pulls = await github(
      input,
      `/repos/${input.repository}/pulls?head=${encodeURIComponent(input.repository.split("/")[0] + ":" + input.branch)}&state=open`,
    );
    if (!pulls.ok) throw new RecallError("github_request_failed", 502);
    const list = (await pulls.json()) as { html_url?: string }[];
    if (list[0]?.html_url) return list[0].html_url;
  } else if (existing.status !== 404) {
    throw new RecallError("github_request_failed", 502);
  } else {
    const treeEntries: { path: string; mode: "100644"; type: "blob"; sha: string }[] = [];
    for (const [filePath, content] of input.files) {
      const blob = await github(input, `/repos/${input.repository}/git/blobs`, {
        method: "POST",
        body: JSON.stringify({ content, encoding: "utf-8" }),
      });
      if (!blob.ok) throw new RecallError("github_request_failed", 502);
      const blobBody = (await blob.json()) as { sha?: string };
      if (!blobBody.sha) throw new RecallError("github_request_failed", 502);
      treeEntries.push({ path: filePath, mode: "100644", type: "blob", sha: blobBody.sha });
    }
    for (const extraPath of [
      "supabase/seed_entities.sql",
      "ontology/seed/entities.json",
      "ontology/seed/relationships.json",
      "_control/triage.md",
      "INDEX.md",
    ]) {
      if (!fs.existsSync(path.join(input.root, extraPath))) continue;
      const content = fs.readFileSync(path.join(input.root, extraPath), "utf8");
      const blob = await github(input, `/repos/${input.repository}/git/blobs`, {
        method: "POST",
        body: JSON.stringify({ content, encoding: "utf-8" }),
      });
      if (!blob.ok) throw new RecallError("github_request_failed", 502);
      const blobBody = (await blob.json()) as { sha?: string };
      if (!blobBody.sha) throw new RecallError("github_request_failed", 502);
      treeEntries.push({ path: extraPath, mode: "100644", type: "blob", sha: blobBody.sha });
    }
    const tree = await github(input, `/repos/${input.repository}/git/trees`, {
      method: "POST",
      body: JSON.stringify({ base_tree: baseSha, tree: treeEntries }),
    });
    if (!tree.ok) throw new RecallError("github_request_failed", 502);
    const treeBody = (await tree.json()) as { sha?: string };
    if (!treeBody.sha) throw new RecallError("github_request_failed", 502);
    const commit = await github(input, `/repos/${input.repository}/git/commits`, {
      method: "POST",
      body: JSON.stringify({ message: input.title, tree: treeBody.sha, parents: [baseSha] }),
    });
    if (!commit.ok) throw new RecallError("github_request_failed", 502);
    const commitBody = (await commit.json()) as { sha?: string };
    if (!commitBody.sha) throw new RecallError("github_request_failed", 502);
    const ref = await github(input, `/repos/${input.repository}/git/refs`, {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${input.branch}`, sha: commitBody.sha }),
    });
    if (!ref.ok) throw new RecallError("github_request_failed", 502);
  }

  const created = await github(input, `/repos/${input.repository}/pulls`, {
    method: "POST",
    body: JSON.stringify({
      title: input.title,
      head: input.branch,
      base: input.base,
      draft: true,
      body: input.body,
    }),
  });
  if (!created.ok) throw new RecallError("github_request_failed", 502);
  const pull = (await created.json()) as { html_url?: string };
  if (!pull.html_url) throw new RecallError("github_request_failed", 502);
  return pull.html_url;
}

async function github(input: { fetch: typeof fetch; token: string }, path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${input.token}`);
  headers.set("Accept", "application/vnd.github+json");
  headers.set("X-GitHub-Api-Version", "2022-11-28");
  headers.set("User-Agent", "enterprise-mind");
  if (init?.body) headers.set("Content-Type", "application/json");
  return input.fetch(`https://api.github.com${path}`, { ...init, headers });
}

function readEntities(root: string): CatalogEntity[] {
  return JSON.parse(fs.readFileSync(path.join(root, "ontology/seed/entities.json"), "utf8")) as CatalogEntity[];
}

function writeRepoFile(root: string, relative: string, content: string): void {
  const absolute = path.join(root, relative);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content);
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "item";
}

function sql(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
