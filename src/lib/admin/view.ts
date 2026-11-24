import { requireActiveSubscription, stripeSubscriptionHook, SubscriptionInactiveError } from "../subscription";
import { newAuditId } from "../tokens/memory-store";
import type { SubscriberRecord, TokenMetadata, TokenStore, WorkspaceRecord } from "../tokens/store";
import { ADMIN_SUBSCRIBER_ID, adminGateDecision } from "./gate";

export type AdminBotRow = {
  id: string;
  meetingId: string;
  meetingTitle: string;
  recallBotId: string;
  status: string;
  joinAt: string | null;
};

export const SEEDED_ADMIN_BOTS: AdminBotRow[] = [
  {
    id: "bot.kilnwatch-seed",
    meetingId: "meeting.kilnwatch-release-standup",
    meetingTitle: "Kilnwatch release standup",
    recallBotId: "recall-seed-hearthline",
    status: "done",
    joinAt: null,
  },
];

export type SubscriptionRow = {
  workspace: string;
  active: boolean;
  stripeConnected: false;
  note: string;
};

export type AdminView =
  | { kind: "unavailable"; code: "admin_unconfigured" | "admin_forbidden" }
  | { kind: "sign-in" }
  | {
      kind: "ready";
      workspaces: WorkspaceRecord[];
      subscribers: SubscriberRecord[];
      subscription: SubscriptionRow;
      bots: AdminBotRow[];
      tokens: TokenMetadata[];
    };

export function subscriptionSnapshot(env: NodeJS.ProcessEnv): SubscriptionRow {
  let active = false;
  try {
    requireActiveSubscription(env);
    active = true;
  } catch (error) {
    if (!(error instanceof SubscriptionInactiveError)) throw error;
  }
  return {
    workspace: "Hearthline Instruments",
    active,
    stripeConnected: stripeSubscriptionHook.connected,
    note: stripeSubscriptionHook.note,
  };
}

export async function buildAdminView(input: {
  env: NodeJS.ProcessEnv;
  authorizationHeader: string | null;
  adminCookie: string | null;
  store: TokenStore;
  now: () => number;
  loadBots?: () => Promise<AdminBotRow[]>;
}): Promise<AdminView> {
  const configured = adminGateDecision({
    env: input.env,
    authorizationHeader: null,
    adminCookie: null,
    hasAdminRole: true,
  });
  if (!configured.ok && configured.code === "admin_unconfigured") {
    return { kind: "unavailable", code: "admin_unconfigured" };
  }
  const hasAdminRole = await input.store.hasAdminRole(ADMIN_SUBSCRIBER_ID);
  if (!hasAdminRole) return { kind: "unavailable", code: "admin_forbidden" };
  const decision = adminGateDecision({
    env: input.env,
    authorizationHeader: input.authorizationHeader,
    adminCookie: input.adminCookie,
    hasAdminRole,
  });
  if (!decision.ok) return { kind: "sign-in" };
  const [workspaces, subscribers, tokens, bots] = await Promise.all([
    input.store.listWorkspaces(),
    input.store.listSubscribers(),
    input.store.listAllMetadata(),
    (input.loadBots ?? (async () => SEEDED_ADMIN_BOTS))(),
  ]);
  const viewedAt = new Date(input.now()).toISOString();
  await input.store.appendAudit({
    id: newAuditId(),
    actorSubscriberId: ADMIN_SUBSCRIBER_ID,
    action: "admin.view",
    target: "admin",
    detail: { page: "admin" },
    createdAt: viewedAt,
  });
  return {
    kind: "ready",
    workspaces,
    subscribers,
    subscription: subscriptionSnapshot(input.env),
    bots,
    tokens,
  };
}
