import { createServiceClient } from "../supabase";
import { RecallError } from "./errors";

export type MeetingRecord = {
  id: string;
  title: string;
  projectId: string;
  calendarEventId: string | null;
  decisionId: string | null;
  meetingUrl: string | null;
  startsAt: string | null;
};

export type BotRecord = {
  id: string;
  meetingId: string;
  recallBotId: string;
  status: string;
  joinAt: string | null;
};

export type ArtifactRecord = {
  id: string;
  meetingId: string;
  botId: string | null;
  kind: "transcript" | "recording";
  contentSha256: string;
  segmentCount: number;
  speakers: string[];
  recallTranscriptId: string | null;
  recallRecordingId: string | null;
  conversationUnitPath: string | null;
  decisionUnitPath: string | null;
};

export type ActionItemRecord = {
  id: string;
  name: string;
  summary: string;
  projectId: string;
  meetingId: string | null;
  ownerRoleId: string | null;
  state: "open" | "done";
};

export type DecisionRecord = {
  id: string;
  name: string;
  summary: string;
  projectId: string;
  state: "proposed" | "accepted" | "superseded";
};

export type RelationshipRecord = {
  id: string;
  type: string;
  fromType: string;
  fromId: string;
  toType: string;
  toId: string;
};

export type UnitRefRecord = {
  id: string;
  unitType: string;
  scope: "project" | "company";
  projectId: string;
  sourceId: string;
  title: string;
  unitPath: string;
  owner: string;
  entityIds: string[];
};

export type RecallSnapshot = {
  meetings: MeetingRecord[];
  bots: BotRecord[];
  artifacts: ArtifactRecord[];
  actionItems: ActionItemRecord[];
  decisions: DecisionRecord[];
  relationships: RelationshipRecord[];
  unitRefs: UnitRefRecord[];
};

export interface RecallStore {
  createMeeting(input: MeetingRecord): Promise<MeetingRecord>;
  createBot(input: BotRecord): Promise<BotRecord>;
  updateBotStatus(recallBotId: string, status: string): Promise<void>;
  findBotByRecallId(recallBotId: string): Promise<BotRecord | null>;
  findMeeting(id: string): Promise<MeetingRecord | null>;
  setMeetingDecision(meetingId: string, decisionId: string): Promise<void>;
  hasArtifact(hash: string): Promise<boolean>;
  saveArtifact(artifact: ArtifactRecord): Promise<"created" | "exists">;
  saveActionItem(item: ActionItemRecord): Promise<void>;
  saveDecision(item: DecisionRecord): Promise<void>;
  saveRelationship(relationship: RelationshipRecord): Promise<void>;
  saveUnitRef(ref: UnitRefRecord): Promise<void>;
  snapshot(): Promise<RecallSnapshot>;
}

export function artifactInsert(artifact: ArtifactRecord): Record<string, unknown> {
  return {
    id: artifact.id,
    meeting_id: artifact.meetingId,
    bot_id: artifact.botId,
    kind: artifact.kind,
    content_sha256: artifact.contentSha256,
    segment_count: artifact.segmentCount,
    speakers: artifact.speakers,
    recall_transcript_id: artifact.recallTranscriptId,
    recall_recording_id: artifact.recallRecordingId,
    conversation_unit_path: artifact.conversationUnitPath,
    decision_unit_path: artifact.decisionUnitPath,
  };
}

export class MemoryRecallStore implements RecallStore {
  readonly meetings = new Map<string, MeetingRecord>();
  readonly bots = new Map<string, BotRecord>();
  readonly artifacts = new Map<string, ArtifactRecord>();
  readonly actionItems = new Map<string, ActionItemRecord>();
  readonly decisions = new Map<string, DecisionRecord>();
  readonly relationships = new Map<string, RelationshipRecord>();
  readonly unitRefs = new Map<string, UnitRefRecord>();

  async createMeeting(input: MeetingRecord): Promise<MeetingRecord> {
    this.meetings.set(input.id, input);
    return input;
  }

  async createBot(input: BotRecord): Promise<BotRecord> {
    this.bots.set(input.recallBotId, input);
    return input;
  }

  async updateBotStatus(recallBotId: string, status: string): Promise<void> {
    const bot = this.bots.get(recallBotId);
    if (!bot) return;
    bot.status = status;
  }

  async findBotByRecallId(recallBotId: string): Promise<BotRecord | null> {
    return this.bots.get(recallBotId) ?? null;
  }

  async findMeeting(id: string): Promise<MeetingRecord | null> {
    return this.meetings.get(id) ?? null;
  }

  async setMeetingDecision(meetingId: string, decisionId: string): Promise<void> {
    const meeting = this.meetings.get(meetingId);
    if (!meeting || meeting.decisionId) return;
    meeting.decisionId = decisionId;
  }

  async hasArtifact(hash: string): Promise<boolean> {
    return this.artifacts.has(hash);
  }

  async saveArtifact(artifact: ArtifactRecord): Promise<"created" | "exists"> {
    if (this.artifacts.has(artifact.contentSha256)) return "exists";
    this.artifacts.set(artifact.contentSha256, artifact);
    return "created";
  }

  async saveActionItem(item: ActionItemRecord): Promise<void> {
    if (!this.actionItems.has(item.id)) this.actionItems.set(item.id, item);
  }

  async saveDecision(item: DecisionRecord): Promise<void> {
    if (!this.decisions.has(item.id)) this.decisions.set(item.id, item);
  }

  async saveRelationship(relationship: RelationshipRecord): Promise<void> {
    const key = `${relationship.type}:${relationship.fromId}:${relationship.toId}`;
    if (!this.relationships.has(key)) this.relationships.set(key, relationship);
  }

  async saveUnitRef(ref: UnitRefRecord): Promise<void> {
    if (!this.unitRefs.has(ref.id)) this.unitRefs.set(ref.id, ref);
  }

  async snapshot(): Promise<RecallSnapshot> {
    return {
      meetings: [...this.meetings.values()],
      bots: [...this.bots.values()],
      artifacts: [...this.artifacts.values()],
      actionItems: [...this.actionItems.values()],
      decisions: [...this.decisions.values()],
      relationships: [...this.relationships.values()],
      unitRefs: [...this.unitRefs.values()],
    };
  }
}

let shared: MemoryRecallStore | null = null;

export function sharedMemoryStore(): MemoryRecallStore {
  shared ??= new MemoryRecallStore();
  return shared;
}

export function resetSharedMemoryStore(): void {
  shared = new MemoryRecallStore();
}

type SupabaseWriter = {
  insert(table: string, row: Record<string, unknown>): Promise<"created" | "exists">;
  update(table: string, column: string, value: string, row: Record<string, unknown>): Promise<void>;
  select(table: string, column: string, value: string): Promise<Record<string, unknown>[]>;
};

export function supabaseRecallStore(writer: SupabaseWriter = serviceWriter()): RecallStore {
  return {
    async createMeeting(input) {
      await writer.insert("meetings", {
        id: input.id,
        title: input.title,
        project_id: input.projectId,
        calendar_event_id: input.calendarEventId,
        decision_id: input.decisionId,
        meeting_url: input.meetingUrl,
        starts_at: input.startsAt,
      });
      return input;
    },
    async createBot(input) {
      await writer.insert("bots", {
        id: input.id,
        meeting_id: input.meetingId,
        recall_bot_id: input.recallBotId,
        status: input.status,
        join_at: input.joinAt,
      });
      return input;
    },
    async updateBotStatus(recallBotId, status) {
      await writer.update("bots", "recall_bot_id", recallBotId, { status });
    },
    async findBotByRecallId(recallBotId) {
      const rows = await writer.select("bots", "recall_bot_id", recallBotId);
      const row = rows[0];
      if (!row) return null;
      return {
        id: String(row.id),
        meetingId: String(row.meeting_id),
        recallBotId: String(row.recall_bot_id),
        status: String(row.status),
        joinAt: row.join_at ? String(row.join_at) : null,
      };
    },
    async findMeeting(id) {
      const rows = await writer.select("meetings", "id", id);
      const row = rows[0];
      if (!row) return null;
      return {
        id: String(row.id),
        title: String(row.title),
        projectId: String(row.project_id),
        calendarEventId: row.calendar_event_id ? String(row.calendar_event_id) : null,
        decisionId: row.decision_id ? String(row.decision_id) : null,
        meetingUrl: row.meeting_url ? String(row.meeting_url) : null,
        startsAt: row.starts_at ? String(row.starts_at) : null,
      };
    },
    async setMeetingDecision(meetingId, decisionId) {
      const meeting = await this.findMeeting(meetingId);
      if (!meeting || meeting.decisionId) return;
      await writer.update("meetings", "id", meetingId, { decision_id: decisionId });
    },
    async hasArtifact(hash) {
      const rows = await writer.select("meeting_artifacts", "content_sha256", hash);
      return rows.length > 0;
    },
    async saveArtifact(artifact) {
      return writer.insert("meeting_artifacts", artifactInsert(artifact));
    },
    async saveActionItem(item) {
      await writer.insert("action_items", {
        id: item.id,
        name: item.name,
        summary: item.summary,
        project_id: item.projectId,
        meeting_id: item.meetingId,
        owner_role_id: item.ownerRoleId,
        state: item.state,
      });
    },
    async saveDecision(item) {
      await writer.insert("decisions", {
        id: item.id,
        name: item.name,
        summary: item.summary,
        project_id: item.projectId,
        state: item.state,
      });
    },
    async saveRelationship(relationship) {
      await writer.insert("entity_relationships", {
        id: relationship.id,
        relationship_type: relationship.type,
        from_type: relationship.fromType,
        from_id: relationship.fromId,
        to_type: relationship.toType,
        to_id: relationship.toId,
      });
    },
    async saveUnitRef(ref) {
      await writer.insert("unit_refs", {
        id: ref.id,
        unit_type: ref.unitType,
        scope: ref.scope,
        project_id: ref.projectId,
        source_id: ref.sourceId,
        title: ref.title,
        version: 1,
        status: "draft",
        owner: ref.owner,
        unit_path: ref.unitPath,
        commit_sha: null,
        supersedes: null,
      });
      for (const entityId of ref.entityIds) {
        await writer.insert("unit_ref_entities", { unit_id: ref.id, entity_id: entityId });
      }
    },
    async snapshot() {
      throw new RecallError("snapshot_unavailable", 500);
    },
  };
}

function serviceWriter(): SupabaseWriter {
  const client = createServiceClient();
  return {
    async insert(table, row) {
      const { error } = await client.from(table).insert(row);
      if (!error) return "created";
      if (error.code === "23505") return "exists";
      throw new RecallError("supabase_write_failed", 502);
    },
    async update(table, column, value, row) {
      const { error } = await client.from(table).update(row).eq(column, value);
      if (error) throw new RecallError("supabase_write_failed", 502);
    },
    async select(table, column, value) {
      const { data, error } = await client.from(table).select("*").eq(column, value);
      if (error) throw new RecallError("supabase_read_failed", 502);
      return (data ?? []) as Record<string, unknown>[];
    },
  };
}

export function recallStoreForEnv(env: NodeJS.ProcessEnv): RecallStore {
  const mode = env.ENTERPRISE_MIND_DATA_MODE?.trim();
  const configured = supabaseConfigured(env);
  if (mode === "memory") {
    if (env.VERCEL_ENV === "production") throw new RecallError("memory_refused", 503);
    return sharedMemoryStore();
  }
  if (mode === "supabase" || configured) {
    if (!configured) throw new RecallError("supabase_not_configured", 503);
    return supabaseRecallStore();
  }
  if (env.VERCEL_ENV === "production") throw new RecallError("supabase_not_configured", 503);
  return sharedMemoryStore();
}

function supabaseConfigured(env: NodeJS.ProcessEnv): boolean {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  const service = env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!url || !anon || !service) return false;
  if (/placeholder|your-project|example\.supabase|changeme|xxxxx/i.test(`${url} ${anon} ${service}`)) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
