import { createHash } from "node:crypto";
import { extractDeterministic } from "../extract";

export type TranscriptSegment = {
  speaker: string;
  text: string;
};

export type MeetingNote = {
  title: string;
  ownerName: string | null;
};

export function sha256Hex(bytes: Uint8Array | string): string {
  const hash = createHash("sha256");
  hash.update(bytes);
  return hash.digest("hex");
}

export function normalizeTranscript(payload: unknown): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  for (const item of segmentList(payload)) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const text = segmentText(record);
    if (!text) continue;
    segments.push({ speaker: speakerName(record), text });
  }
  return segments;
}

export function uniqueSpeakers(segments: TranscriptSegment[]): string[] {
  const seen = new Set<string>();
  const speakers: string[] = [];
  for (const segment of segments) {
    if (seen.has(segment.speaker)) continue;
    seen.add(segment.speaker);
    speakers.push(segment.speaker);
    if (speakers.length === 20) break;
  }
  return speakers;
}

/**
 * Rule-based extraction only. This function does not call a model.
 * Titles are kept. Source excerpts are dropped so the transcript is not copied forward.
 */
export type UnresolvedClaim = {
  kind: string;
  title: string;
};

export function extractMeetingNotes(text: string): {
  actions: MeetingNote[];
  decisions: MeetingNote[];
  unresolved: UnresolvedClaim[];
} {
  const drafts = extractDeterministic(text);
  const actions: MeetingNote[] = [];
  const decisions: MeetingNote[] = [];
  const unresolved: UnresolvedClaim[] = [];
  for (const draft of drafts) {
    const note = { title: draft.title, ownerName: draft.ownerName };
    if (draft.unitType === "pending_task") actions.push(note);
    else if (draft.unitType === "design_decision") decisions.push(note);
    else unresolved.push({ kind: draft.unitType, title: draft.title });
  }
  return { actions, decisions, unresolved };
}

/** Segments with no labeled claim. The text is not returned. */
export function unlabeledClaims(segments: TranscriptSegment[]): UnresolvedClaim[] {
  const claims: UnresolvedClaim[] = [];
  for (const segment of segments) {
    if (extractDeterministic(segment.text).length > 0) continue;
    claims.push({ kind: "unlabeled", title: "discarded" });
  }
  return claims;
}

export function roleIdForOwner(ownerName: string | null): string | null {
  if (!ownerName) return null;
  const key = ownerName.trim().toLowerCase();
  if (key === "catalog editor") return "person-role.catalog-editor";
  if (key === "calibration owner") return "person-role.calibration-owner";
  if (key === "studio lead") return "person-role.studio-lead";
  return null;
}

function segmentList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  for (const key of ["transcript", "results", "segments"]) {
    if (Array.isArray(record[key])) return record[key];
  }
  return [];
}

function speakerName(record: Record<string, unknown>): string {
  const direct = typeof record.speaker === "string" ? record.speaker : "";
  const participant = record.participant;
  const nested =
    participant && typeof participant === "object" && typeof (participant as { name?: unknown }).name === "string"
      ? (participant as { name: string }).name
      : "";
  const name = (direct || nested).trim().slice(0, 80);
  if (!name || name.includes("@")) return "Unknown speaker";
  return name;
}

function segmentText(record: Record<string, unknown>): string {
  if (typeof record.text === "string") return record.text.trim();
  if (!Array.isArray(record.words)) return "";
  const text = record.words
    .map((word) => {
      if (typeof word === "string") return word;
      if (!word || typeof word !== "object") return "";
      return typeof (word as { text?: unknown }).text === "string" ? (word as { text: string }).text : "";
    })
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return text;
}
