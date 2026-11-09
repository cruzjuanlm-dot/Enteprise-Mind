import type { DraftUnit, FieldPresence, UnitType } from "./domain";

const HEADER =
  /^(?:([^:\n]{1,80}):\s+)?(decision|design decision|task|pending task|action|architecture|risk|open question|question|term|glossary)\s*:\s*(.+)$/i;
const FIELD =
  /^(owner|dependencies|dependency|systems touched|systems|acceptance criteria|acceptance|due date|due|approval required|approval|details|body|context)\s*:\s*(.*)$/i;
const UNKNOWN = /^(unknown|unspecified|tbd|n\/a|not specified|not stated)$/i;
const NONE = /^(none|no|nothing|no dependencies|no systems|-)$/i;
const APPROVAL_YES = /^(required|yes|true)$/i;
const APPROVAL_NO = /^(not required|no|false|optional)$/i;

const MAX_UNITS = 50;

type Block = {
  kind: string;
  title: string;
  fields: Record<string, string>;
  raw: string[];
};

export function extractDeterministic(text: string): DraftUnit[] {
  const blocks: Block[] = [];
  let current: Block | null = null;
  const flush = () => {
    if (current) blocks.push(current);
    current = null;
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    const header = line.match(HEADER);
    if (header) {
      flush();
      current = { kind: header[2].toLowerCase(), title: header[3].trim(), fields: {}, raw: [line] };
      continue;
    }
    if (!current || !line) {
      if (!line) flush();
      continue;
    }
    current.raw.push(line);
    const field = line.match(FIELD);
    if (!field) continue;
    current.fields[canonicalField(field[1])] = field[2].trim();
  }
  flush();

  return blocks.slice(0, MAX_UNITS).map(toDraft).filter((unit) => unit.title.length > 0);
}

export function sanitizeDraft(input: Partial<DraftUnit> | null | undefined): DraftUnit | null {
  if (!input) return null;
  const unitType = asUnitType(input.unitType);
  const title = cleanText(input.title, 200);
  if (!unitType || !title) return null;
  const body = cleanText(input.body, 4000) || title;
  const excerpt = cleanText(input.sourceExcerpt, 2000) || title;
  const owner = presenceText(input.ownerPresence, input.ownerName, 120);
  const dependencies = presenceList(input.dependenciesPresence, input.dependencies);
  const systems = presenceList(input.systemsPresence, input.systemsTouched);
  const acceptance = presenceText(input.acceptancePresence, input.acceptanceCriteria, 1000);
  const due = presenceDate(input.duePresence, input.dueDate);
  const approval = presenceBoolean(input.approvalPresence, input.approvalRequired);
  return {
    unitType,
    title,
    body,
    sourceExcerpt: excerpt,
    ownerName: owner.presence === "known" ? owner.value : null,
    ownerPresence: owner.presence,
    dependencies: dependencies.presence === "known" ? dependencies.value : [],
    dependenciesPresence: dependencies.presence,
    systemsTouched: systems.presence === "known" ? systems.value : [],
    systemsPresence: systems.presence,
    acceptanceCriteria: acceptance.presence === "known" ? acceptance.value : null,
    acceptancePresence: acceptance.presence,
    dueDate: due.presence === "known" ? due.value : null,
    duePresence: due.presence,
    approvalRequired: approval.presence === "known" ? approval.value : null,
    approvalPresence: approval.presence,
  };
}

export async function extractUnits(text: string): Promise<DraftUnit[]> {
  const key = process.env.EXTRACTION_MODEL_API_KEY?.trim();
  if (!key) return extractDeterministic(text);
  const base = process.env.EXTRACTION_MODEL_BASE_URL?.trim();
  if (!base) throw new Error("model_misconfigured");
  const model = process.env.EXTRACTION_MODEL?.trim() || "gpt-4o-mini";
  return extractWithModel(text, { key, base, model });
}

async function extractWithModel(
  text: string,
  config: { key: string; base: string; model: string },
): Promise<DraftUnit[]> {
  const endpoint = `${config.base.replace(/\/$/, "")}/chat/completions`;
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Extract knowledge units from a transcript. Return JSON {\"units\":[...]}. " +
              "Each unit has unitType (architecture, design_decision, pending_task, risk, open_question, glossary_term), title, body, sourceExcerpt, " +
              "and owner, dependencies, systems, acceptanceCriteria, dueDate, approvalRequired. " +
              "Each of those six fields is {\"presence\":\"known\",\"value\":...} or {\"presence\":\"unknown\"}. " +
              "Never invent an owner, system, date, dependency, acceptance criterion, or approval. Missing means unknown. " +
              "dueDate value must be YYYY-MM-DD. approvalRequired value must be boolean. dependencies and systems values must be string arrays.",
          },
          { role: "user", content: text.slice(0, 100_000) },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new Error("model_request_failed");
  }
  if (!response.ok) throw new Error("model_request_failed");

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("model_request_failed");
  }
  const content = readModelContent(payload);
  if (!content) throw new Error("model_request_failed");
  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch {
    throw new Error("model_request_failed");
  }
  const units = readModelUnits(parsed);
  return units.slice(0, MAX_UNITS);
}

function readModelContent(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") return null;
  const message = (choices[0] as { message?: unknown }).message;
  if (!message || typeof message !== "object") return null;
  const content = (message as { content?: unknown }).content;
  return typeof content === "string" ? content : null;
}

function readModelUnits(parsed: unknown): DraftUnit[] {
  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { units?: unknown }).units)
      ? (parsed as { units: unknown[] }).units
      : [];
  const drafts: DraftUnit[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const draft = sanitizeDraft({
      unitType: asUnitType(record.unitType) ?? undefined,
      title: typeof record.title === "string" ? record.title : undefined,
      body: typeof record.body === "string" ? record.body : undefined,
      sourceExcerpt: typeof record.sourceExcerpt === "string" ? record.sourceExcerpt : undefined,
      ...fieldFrom(record.owner, "text"),
      ...listFieldFrom(record.dependencies, "dependencies"),
      ...listFieldFrom(record.systems, "systems"),
      ...fieldFrom(record.acceptanceCriteria, "acceptance"),
      ...fieldFrom(record.dueDate, "date"),
      ...fieldFrom(record.approvalRequired, "boolean"),
    });
    if (draft) drafts.push(draft);
  }
  return drafts;
}

function fieldFrom(value: unknown, kind: "text" | "acceptance" | "date" | "boolean"): Partial<DraftUnit> {
  const present = unpack(value);
  if (kind === "boolean") {
    return {
      approvalPresence: present.presence,
      approvalRequired: typeof present.value === "boolean" ? present.value : null,
    };
  }
  if (kind === "date") {
    return {
      duePresence: present.presence,
      dueDate: typeof present.value === "string" ? present.value : null,
    };
  }
  if (kind === "acceptance") {
    return {
      acceptancePresence: present.presence,
      acceptanceCriteria: typeof present.value === "string" ? present.value : null,
    };
  }
  return {
    ownerPresence: present.presence,
    ownerName: typeof present.value === "string" ? present.value : null,
  };
}

function listFieldFrom(value: unknown, kind: "dependencies" | "systems"): Partial<DraftUnit> {
  const present = unpack(value);
  const list = Array.isArray(present.value) ? present.value.filter((item): item is string => typeof item === "string") : [];
  if (kind === "dependencies") {
    return { dependenciesPresence: present.presence, dependencies: list };
  }
  return { systemsPresence: present.presence, systemsTouched: list };
}

function unpack(value: unknown): { presence: FieldPresence; value: unknown } {
  if (!value || typeof value !== "object") return { presence: "unknown", value: null };
  const presence = (value as { presence?: unknown }).presence;
  if (presence !== "known") return { presence: "unknown", value: null };
  return { presence: "known", value: (value as { value?: unknown }).value ?? null };
}

function toDraft(block: Block): DraftUnit {
  const unitType = kindToType(block.kind);
  const owner = knownText(block.fields.owner, false);
  const dependencies = knownList(block.fields.dependencies);
  const systems = knownList(block.fields.systems);
  const acceptance = knownText(block.fields.acceptance, false);
  const due = knownDate(block.fields.due);
  const approval = knownApproval(block.fields.approval);
  const body = cleanText(block.fields.details, 4000) || block.title;
  return {
    unitType,
    title: block.title.slice(0, 200),
    body,
    sourceExcerpt: block.raw.join("\n").slice(0, 2000),
    ownerName: owner.presence === "known" ? owner.value : null,
    ownerPresence: owner.presence,
    dependencies: dependencies.presence === "known" ? dependencies.value : [],
    dependenciesPresence: dependencies.presence,
    systemsTouched: systems.presence === "known" ? systems.value : [],
    systemsPresence: systems.presence,
    acceptanceCriteria: acceptance.presence === "known" ? acceptance.value : null,
    acceptancePresence: acceptance.presence,
    dueDate: due.presence === "known" ? due.value : null,
    duePresence: due.presence,
    approvalRequired: approval.presence === "known" ? approval.value : null,
    approvalPresence: approval.presence,
  };
}

function kindToType(kind: string): UnitType {
  if (kind === "decision" || kind === "design decision") return "design_decision";
  if (kind === "task" || kind === "pending task" || kind === "action") return "pending_task";
  if (kind === "architecture") return "architecture";
  if (kind === "risk") return "risk";
  if (kind === "open question" || kind === "question") return "open_question";
  return "glossary_term";
}

function canonicalField(label: string): string {
  const value = label.toLowerCase();
  if (value.startsWith("owner")) return "owner";
  if (value.startsWith("depend")) return "dependencies";
  if (value.startsWith("system")) return "systems";
  if (value.startsWith("accept")) return "acceptance";
  if (value.startsWith("due")) return "due";
  if (value.startsWith("approv")) return "approval";
  return "details";
}

function knownText(value: string | undefined, allowNone: boolean): { presence: FieldPresence; value: string } {
  if (value === undefined || value === "" || UNKNOWN.test(value)) return { presence: "unknown", value: "" };
  if (!allowNone && NONE.test(value)) return { presence: "unknown", value: "" };
  return { presence: "known", value: value.slice(0, 1000) };
}

function knownList(value: string | undefined): { presence: FieldPresence; value: string[] } {
  if (value === undefined || value === "" || UNKNOWN.test(value)) return { presence: "unknown", value: [] };
  if (NONE.test(value)) return { presence: "known", value: [] };
  const items = value
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && !UNKNOWN.test(item))
    .slice(0, 20);
  return { presence: "known", value: items };
}

function knownDate(value: string | undefined): { presence: FieldPresence; value: string } {
  if (value === undefined || value === "" || UNKNOWN.test(value) || NONE.test(value)) {
    return { presence: "unknown", value: "" };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { presence: "unknown", value: "" };
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    return { presence: "unknown", value: "" };
  }
  return { presence: "known", value };
}

function knownApproval(value: string | undefined): { presence: FieldPresence; value: boolean } {
  if (value === undefined || value === "" || UNKNOWN.test(value)) return { presence: "unknown", value: false };
  if (APPROVAL_YES.test(value)) return { presence: "known", value: true };
  if (APPROVAL_NO.test(value)) return { presence: "known", value: false };
  return { presence: "unknown", value: false };
}

function presenceText(
  presence: FieldPresence | undefined,
  value: string | null | undefined,
  max: number,
): { presence: FieldPresence; value: string } {
  const cleaned = cleanText(value, max);
  if (presence !== "known" || !cleaned || UNKNOWN.test(cleaned)) return { presence: "unknown", value: "" };
  return { presence: "known", value: cleaned };
}

function presenceList(
  presence: FieldPresence | undefined,
  value: string[] | undefined,
): { presence: FieldPresence; value: string[] } {
  if (presence !== "known" || !Array.isArray(value)) return { presence: "unknown", value: [] };
  return {
    presence: "known",
    value: value.map((item) => item.trim()).filter(Boolean).slice(0, 20),
  };
}

function presenceDate(
  presence: FieldPresence | undefined,
  value: string | null | undefined,
): { presence: FieldPresence; value: string } {
  if (presence !== "known") return { presence: "unknown", value: "" };
  return knownDate(value ?? undefined);
}

function presenceBoolean(
  presence: FieldPresence | undefined,
  value: boolean | null | undefined,
): { presence: FieldPresence; value: boolean } {
  if (presence !== "known" || typeof value !== "boolean") return { presence: "unknown", value: false };
  return { presence: "known", value };
}

function asUnitType(value: unknown): UnitType | null {
  if (
    value === "architecture" ||
    value === "design_decision" ||
    value === "pending_task" ||
    value === "risk" ||
    value === "open_question" ||
    value === "glossary_term"
  ) {
    return value;
  }
  return null;
}

function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}
