import { FIXTURES } from "../fixtures";
import { HEARTHLINE_ADMIN_ID, HEARTHLINE_EDITOR_ID } from "./seed-meta";
import type { SubscriberRecord, TokenStore } from "./store";

const LOCAL_SUBSCRIBER: Record<string, string> = {
  [FIXTURES.admin]: HEARTHLINE_ADMIN_ID,
  [FIXTURES.reviewer]: HEARTHLINE_EDITOR_ID,
};

export async function subscriberForActor(
  actor: { userId: string; email: string } | null,
  store: TokenStore,
): Promise<SubscriberRecord | null> {
  if (!actor) return null;
  const mapped = LOCAL_SUBSCRIBER[actor.userId];
  if (mapped) return store.getSubscriber(mapped);
  if (actor.email) return store.findSubscriberByEmail(actor.email);
  return null;
}
