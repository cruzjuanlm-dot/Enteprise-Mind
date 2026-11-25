import { randomUUID, timingSafeEqual } from "node:crypto";
import { createRecallBot, type CreateBotPayload } from "./client";
import { botsAuthSecret, JOIN_AT_LEAD_MS, recallApiKey, recallRegion } from "./config";
import type { RecallDeps } from "./deps";
import { RecallError } from "./errors";
import { recallErrorResponse } from "./http";
import { SubscriptionInactiveError, requireActiveSubscription } from "../subscription";
import { authenticatePlaintext } from "../tokens/authenticate";
import { TOKEN_PREFIX, TokenAuthError } from "../tokens/crypto";

const BOT_NAME = "Enterprise Mind";

export async function handleCreateBot(request: Request, deps: RecallDeps): Promise<Response> {
  try {
    await authorizeCaller(request, deps);
    requireActiveSubscription(deps.env);
    const region = recallRegion(deps.env);
    const apiKey = recallApiKey(deps.env);
    const body = await readBody(request);
    const startsAt = body.startsAt ? new Date(body.startsAt) : null;
    if (body.startsAt && (!startsAt || Number.isNaN(startsAt.getTime()))) {
      throw new RecallError("invalid_request", 400);
    }
    const scheduled = Boolean(startsAt && startsAt.getTime() - deps.now() > JOIN_AT_LEAD_MS);
    const payload: CreateBotPayload = {
      meeting_url: body.meetingUrl,
      bot_name: BOT_NAME,
      recording_config: {
        transcript: {
          provider: {
            recallai_streaming: {},
          },
        },
      },
    };
    if (scheduled && startsAt) payload.join_at = startsAt.toISOString();
    const created = await createRecallBot({
      region,
      apiKey,
      payload,
      fetch: deps.fetch,
      sleep: deps.sleep,
    });
    const meeting = await deps.store.createMeeting({
      id: `meeting.${randomUUID()}`,
      title: body.title,
      projectId: body.projectId,
      calendarEventId: null,
      decisionId: null,
      meetingUrl: body.meetingUrl,
      startsAt: startsAt ? startsAt.toISOString() : null,
    });
    const bot = await deps.store.createBot({
      id: `bot.${randomUUID()}`,
      meetingId: meeting.id,
      recallBotId: created.id,
      status: scheduled ? "scheduled" : "joining",
      joinAt: payload.join_at ?? null,
    });
    return Response.json(
      {
        meetingId: meeting.id,
        botId: bot.id,
        recallBotId: created.id,
        joinAt: bot.joinAt,
        scheduled,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof SubscriptionInactiveError || error instanceof TokenAuthError) {
      return Response.json({ error: error.code }, { status: error.status });
    }
    return recallErrorResponse(error);
  }
}

async function authorizeCaller(request: Request, deps: RecallDeps): Promise<void> {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/.exec(header);
  const presented = match?.[1] ?? "";
  if (presented.startsWith(TOKEN_PREFIX)) {
    if (!deps.tokenStore) throw new RecallError("unauthorized", 401);
    try {
      await authenticatePlaintext(presented, {
        env: deps.env,
        store: deps.tokenStore,
        now: deps.now(),
        requiredScope: "meetings:write",
      });
    } catch (error) {
      if (error instanceof TokenAuthError) throw new RecallError(error.code, error.status);
      throw error;
    }
    return;
  }
  const secret = botsAuthSecret(deps.env);
  if (!safeEqual(presented, secret)) throw new RecallError("unauthorized", 403);
}

async function readBody(request: Request): Promise<{ meetingUrl: string; title: string; projectId: string; startsAt: string | null }> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    throw new RecallError("invalid_request", 400);
  }
  if (!payload || typeof payload !== "object") throw new RecallError("invalid_request", 400);
  const record = payload as Record<string, unknown>;
  const meetingUrl = typeof record.meetingUrl === "string" ? record.meetingUrl.trim() : "";
  if (!meetingUrl.startsWith("https://") || meetingUrl.length > 2000) throw new RecallError("invalid_request", 400);
  const title = typeof record.title === "string" && record.title.trim() ? record.title.trim().slice(0, 200) : "Meeting";
  const projectId = typeof record.projectId === "string" && record.projectId.trim() ? record.projectId.trim() : "project.kilnwatch";
  if (!/^project\.[a-z0-9]+(?:-[a-z0-9]+)*$/.test(projectId)) throw new RecallError("invalid_request", 400);
  const startsAt = typeof record.startsAt === "string" && record.startsAt.trim() ? record.startsAt.trim() : null;
  return { meetingUrl, title, projectId, startsAt };
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) {
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}
