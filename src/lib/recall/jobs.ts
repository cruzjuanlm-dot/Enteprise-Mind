import { randomUUID } from "node:crypto";
import { deniedTerms } from "../denylist";
import { fetchTranscriptDownload } from "./client";
import { assertRuleBasedExtraction, downloadHosts, recallApiKey, recallRegion } from "./config";
import type { RecallDeps } from "./deps";
import { RecallError } from "./errors";
import { publishMeetingUnits } from "./publish";
import type { BotRecord, MeetingRecord } from "./store";
import { extractMeetingNotes, normalizeTranscript, sha256Hex, uniqueSpeakers } from "./transcript";

export type RecallEvent = {
  webhookId: string;
  event: string;
  botId: string;
  transcriptId: string;
  recordingId: string;
  statusCode: string;
};

const DEFAULT_PROJECT = "project.kilnwatch";

export function parseRecallEvent(payload: unknown, webhookId: string): RecallEvent | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as { event?: unknown; data?: unknown };
  if (typeof record.event !== "string" || record.event.trim() === "") return null;
  const data = record.data && typeof record.data === "object" ? (record.data as Record<string, unknown>) : {};
  const nested = data.data && typeof data.data === "object" ? (data.data as Record<string, unknown>) : {};
  const status = data.status && typeof data.status === "object" ? (data.status as Record<string, unknown>) : {};
  return {
    webhookId,
    event: record.event,
    botId: readId(data.bot) || stringValue(data.bot_id),
    transcriptId: readId(data.transcript) || stringValue(data.transcript_id),
    recordingId: readId(data.recording) || stringValue(data.recording_id),
    statusCode: stringValue(nested.code) || stringValue(status.code) || record.event.split(".").slice(1).join("."),
  };
}

/**
 * Webhook work runs after the 2xx response. Bot status is taken from the event.
 * This function never requests bot status from Recall.
 */
export async function processRecallEvent(event: RecallEvent, deps: RecallDeps): Promise<void> {
  assertRuleBasedExtraction(deps.env);
  if (event.event === "transcript.failed" || event.event.startsWith("bot.")) {
    if (event.botId) await deps.store.updateBotStatus(event.botId, event.statusCode || event.event);
    return;
  }
  if (event.event === "recording.done") {
    await recordRecordingPointer(event, deps);
    return;
  }
  if (event.event === "transcript.done") {
    await ingestTranscript(event, deps);
  }
}

async function recordRecordingPointer(event: RecallEvent, deps: RecallDeps): Promise<void> {
  if (!event.recordingId) return;
  const hash = sha256Hex(`recording:${event.recordingId}`);
  if (await deps.store.hasArtifact(hash)) return;
  const bot = event.botId ? await deps.store.findBotByRecallId(event.botId) : null;
  if (!bot) return;
  await deps.store.saveArtifact({
    id: `artifact.${randomUUID()}`,
    meetingId: bot.meetingId,
    botId: bot.id,
    kind: "recording",
    contentSha256: hash,
    segmentCount: 0,
    speakers: [],
    recallTranscriptId: null,
    recallRecordingId: event.recordingId,
    conversationUnitPath: null,
    decisionUnitPath: null,
  });
  await deps.store.updateBotStatus(event.botId, "recording_done");
}

async function ingestTranscript(event: RecallEvent, deps: RecallDeps): Promise<void> {
  if (!event.transcriptId) throw new RecallError("transcript_fetch_failed", 502);
  const bytes = await fetchTranscriptDownload({
    region: recallRegion(deps.env),
    apiKey: recallApiKey(deps.env),
    transcriptId: event.transcriptId,
    hosts: downloadHosts(deps.env),
    fetch: deps.fetch,
  });
  const hash = sha256Hex(bytes);
  if (await deps.store.hasArtifact(hash)) return;

  const decoded = new TextDecoder().decode(bytes);
  let payload: unknown;
  try {
    payload = JSON.parse(decoded) as unknown;
  } catch {
    throw new RecallError("transcript_unreadable", 422);
  }
  const segments = normalizeTranscript(payload);
  const spoken = segments.map((segment) => segment.text).join("\n\n");
  const speakers = uniqueSpeakers(segments);
  if (deniedTerms(`${spoken}\n${speakers.join("\n")}`).length > 0) return;

  const notes = extractMeetingNotes(spoken);
  const { meeting, bot } = await ensureMeeting(event, deps);
  const published = await publishMeetingUnits({
    root: deps.root,
    env: deps.env,
    fetch: deps.fetch,
    meetingTitle: meeting.title,
    hash,
    segmentCount: segments.length,
    projectId: meeting.projectId,
    actions: notes.actions,
    decisions: notes.decisions,
  });
  const saved = await deps.store.saveArtifact({
    id: `artifact.${randomUUID()}`,
    meetingId: meeting.id,
    botId: bot?.id ?? null,
    kind: "transcript",
    contentSha256: hash,
    segmentCount: segments.length,
    speakers,
    recallTranscriptId: event.transcriptId,
    recallRecordingId: event.recordingId || null,
    conversationUnitPath: published.conversationPath,
    decisionUnitPath: published.decisionPath,
  });
  if (saved === "exists") return;

  for (const action of published.actions) {
    await deps.store.saveActionItem({
      id: action.id,
      name: action.name,
      summary: action.summary,
      projectId: meeting.projectId,
      meetingId: meeting.id,
      ownerRoleId: action.ownerRoleId,
      state: "open",
    });
    if (action.ownerRoleId) {
      await deps.store.saveRelationship({
        id: `rel.assigns.${action.id.replace(/^action-item\./, "")}`,
        type: "assigns",
        fromType: "action_item",
        fromId: action.id,
        toType: "person_role",
        toId: action.ownerRoleId,
      });
    }
  }
  for (const decision of published.decisions) {
    await deps.store.saveDecision({
      id: decision.id,
      name: decision.name,
      summary: decision.summary,
      projectId: meeting.projectId,
      state: "proposed",
    });
    await deps.store.setMeetingDecision(meeting.id, decision.id);
    await deps.store.saveRelationship({
      id: `rel.governs.${decision.id.replace(/^decision\./, "")}`,
      type: "governs",
      fromType: "decision",
      fromId: decision.id,
      toType: "project",
      toId: meeting.projectId,
    });
    for (const action of published.actions) {
      await deps.store.saveRelationship({
        id: `rel.follows.${action.id.replace(/^action-item\./, "")}`,
        type: "follows",
        fromType: "action_item",
        fromId: action.id,
        toType: "decision",
        toId: decision.id,
      });
    }
  }
  await deps.store.saveUnitRef({
    id: published.conversationId,
    bucket: "conversations",
    title: meeting.title,
    repoPath: published.conversationPath,
    owner: "person-role.catalog-editor",
    entityIds: [meeting.projectId, ...published.decisions.map((note) => note.id), ...published.actions.map((note) => note.id)],
  });
  if (published.decisionUnitId && published.decisionPath) {
    await deps.store.saveUnitRef({
      id: published.decisionUnitId,
      bucket: "decisions",
      title: published.decisions.map((note) => note.name).join("; "),
      repoPath: published.decisionPath,
      owner: "person-role.catalog-editor",
      entityIds: [meeting.projectId, ...published.decisions.map((note) => note.id)],
    });
  }
  if (event.botId) await deps.store.updateBotStatus(event.botId, "transcript_processed");
}

async function ensureMeeting(event: RecallEvent, deps: RecallDeps): Promise<{ meeting: MeetingRecord; bot: BotRecord | null }> {
  const existing = event.botId ? await deps.store.findBotByRecallId(event.botId) : null;
  if (existing) {
    const meeting = await deps.store.findMeeting(existing.meetingId);
    if (meeting) return { meeting, bot: existing };
  }
  const meeting = await deps.store.createMeeting({
    id: `meeting.${randomUUID()}`,
    title: "Meeting",
    projectId: DEFAULT_PROJECT,
    calendarEventId: null,
    decisionId: null,
    meetingUrl: null,
    startsAt: null,
  });
  if (!event.botId) return { meeting, bot: null };
  const bot = await deps.store.createBot({
    id: `bot.${randomUUID()}`,
    meetingId: meeting.id,
    recallBotId: event.botId,
    status: "transcript_ready",
    joinAt: null,
  });
  return { meeting, bot };
}

function readId(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const id = (value as { id?: unknown }).id;
  return typeof id === "string" ? id : "";
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}
