import { createClient } from "@supabase/supabase-js";
import { isPublicSupabaseConfigured } from "../env";
import { SEEDED_ADMIN_BOTS } from "../admin/view";

export const MEETING_STEPS = [
  {
    id: "scheduled",
    label: "Scheduled",
    detail: "The Kilnwatch release standup is on the calendar. No bot has been sent.",
  },
  {
    id: "joining",
    label: "Bot joining",
    detail: "A mocked Recall bot is joining the call. This page does not call Recall.",
  },
  {
    id: "waiting",
    label: "Waiting room",
    detail: "The bot is in the waiting room. Recording has not started.",
  },
  {
    id: "recording",
    label: "In call, recording",
    detail: "Recall's built-in transcription would run here. The demo does not open a socket.",
  },
  {
    id: "transcript_done",
    label: "Transcript ready",
    detail: "The rules reader would compile labeled claims. The words are not kept on this page.",
  },
  {
    id: "discarded",
    label: "Transcript discarded",
    detail: "The artifact keeps a hash, a segment count, and speaker labels. The transcript is gone.",
  },
] as const;

export type MeetingRow = {
  id: string;
  title: string;
  projectId: string;
  startsAt: string | null;
};

export const DEMO_MEETING: MeetingRow & {
  speakers: string[];
  segmentCount: number;
  contentSha256: string;
  recallBotId: string;
  botStatus: string;
} = {
  id: "meeting.kilnwatch-release-standup",
  title: "Kilnwatch release standup",
  projectId: "project.kilnwatch",
  startsAt: "2026-11-20T15:00:00.000Z",
  speakers: ["Catalog editor", "Calibration owner", "Studio lead"],
  segmentCount: 4,
  contentSha256: "e37eae4cbedc025c767b710517bf7cf7815be7628e48c1403415b272cee81917",
  recallBotId: SEEDED_ADMIN_BOTS[0]?.recallBotId ?? "recall-seed-hearthline",
  botStatus: "done",
};

export type MeetingBoard = {
  source: "seed" | "supabase";
  note: string | null;
  meetings: MeetingRow[];
};

export async function loadMeetingBoard(env: NodeJS.ProcessEnv = process.env): Promise<MeetingBoard> {
  const seed = {
    source: "seed" as const,
    note: "Supabase is not configured, so this list is the fictional Kilnwatch standup.",
    meetings: [DEMO_MEETING],
  };
  if (!isPublicSupabaseConfigured(env)) return seed;
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  try {
    const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.from("meetings").select("id, title, project_id, starts_at");
    if (error) throw new Error("meetings_unavailable");
    const meetings = (data ?? []).map((row) => ({
      id: String(row.id),
      title: String(row.title),
      projectId: String(row.project_id),
      startsAt: row.starts_at ? String(row.starts_at) : null,
    }));
    if (meetings.length === 0) {
      return { source: "supabase", note: "The meetings table is empty, so the fictional standup is listed below.", meetings: [DEMO_MEETING] };
    }
    return { source: "supabase", note: null, meetings };
  } catch {
    return {
      source: "seed",
      note: "The meetings read failed, so this list is the fictional Kilnwatch standup.",
      meetings: [DEMO_MEETING],
    };
  }
}
