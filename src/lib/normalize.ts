export type NormalizeResult =
  | { ok: true; text: string; speakers: string[] }
  | { ok: false; reason: "empty_body" | "invalid_format" };

type Turn = { speaker?: unknown; text?: unknown };

export function normalizeTranscript(format: string, content: unknown): NormalizeResult {
  if (format === "json") return normalizeJson(content);
  if (format === "vtt") return normalizeVtt(content);
  if (format === "text") return normalizeText(content);
  return { ok: false, reason: "invalid_format" };
}

export function detectFormat(content: unknown): "text" | "vtt" | "json" {
  if (content && typeof content === "object") return "json";
  if (typeof content !== "string") return "text";
  const trimmed = content.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed) || (parsed && typeof parsed === "object" && "turns" in parsed)) {
        return "json";
      }
    } catch {
      return "text";
    }
  }
  if (trimmed.startsWith("WEBVTT")) return "vtt";
  return "text";
}

function normalizeText(content: unknown): NormalizeResult {
  if (typeof content !== "string") return { ok: false, reason: "invalid_format" };
  const text = content.trim();
  if (!text) return { ok: false, reason: "empty_body" };
  return { ok: true, text, speakers: [] };
}

function normalizeVtt(content: unknown): NormalizeResult {
  if (typeof content !== "string") return { ok: false, reason: "invalid_format" };
  const speakers = new Set<string>();
  const lines: string[] = [];
  let skippingNote = false;
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      skippingNote = false;
      continue;
    }
    if (line === "WEBVTT" || line.startsWith("NOTE") || line.startsWith("STYLE") || line.startsWith("REGION")) {
      skippingNote = line.startsWith("NOTE") || line.startsWith("STYLE") || line.startsWith("REGION");
      continue;
    }
    if (skippingNote) continue;
    if (/^\d+$/.test(line)) continue;
    if (line.includes("-->")) continue;
    const voice = line.match(/^<v(?:\.[^ >]+)?\s+([^>]+)>(.*)$/);
    if (voice) {
      const speaker = voice[1].trim();
      const spoken = voice[2].trim();
      if (speaker) speakers.add(speaker);
      if (spoken) lines.push(speaker ? `${speaker}: ${spoken}` : spoken);
      continue;
    }
    lines.push(line);
  }
  const text = lines.join("\n").trim();
  if (!text) return { ok: false, reason: "empty_body" };
  return { ok: true, text, speakers: [...speakers] };
}

function normalizeJson(content: unknown): NormalizeResult {
  let value = content;
  if (typeof content === "string") {
    try {
      value = JSON.parse(content) as unknown;
    } catch {
      return { ok: false, reason: "invalid_format" };
    }
  }
  const turns = readTurns(value);
  if (!turns) return { ok: false, reason: "invalid_format" };
  const speakers = new Set<string>();
  const lines: string[] = [];
  for (const turn of turns) {
    const text = typeof turn.text === "string" ? turn.text.trim() : "";
    if (!text) continue;
    const speaker = typeof turn.speaker === "string" ? turn.speaker.trim() : "";
    if (speaker) speakers.add(speaker);
    lines.push(speaker ? `${speaker}: ${text}` : text);
  }
  const text = lines.join("\n").trim();
  if (!text) return { ok: false, reason: "empty_body" };
  return { ok: true, text, speakers: [...speakers] };
}

function readTurns(value: unknown): Turn[] | null {
  if (Array.isArray(value)) return value.filter((item) => item && typeof item === "object") as Turn[];
  if (!value || typeof value !== "object" || !("turns" in value)) return null;
  const turns = (value as { turns?: unknown }).turns;
  if (!Array.isArray(turns)) return null;
  return turns.filter((item) => item && typeof item === "object") as Turn[];
}
