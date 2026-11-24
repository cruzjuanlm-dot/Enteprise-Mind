import { handleCreateToken, handleListTokens } from "@/lib/tokens/handlers";
import { tokenStoreForEnv } from "@/lib/tokens/runtime";
import { subscriberForActor } from "@/lib/tokens/session";
import { getContext } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const subscriber = await currentSubscriber();
  if (!subscriber) return Response.json({ error: "unauthorized" }, { status: 401 });
  return handleListTokens({
    env: process.env,
    store: tokenStoreForEnv(),
    now: () => Date.now(),
    subscriber,
  });
}

export async function POST(request: Request) {
  const subscriber = await currentSubscriber();
  if (!subscriber) return Response.json({ error: "unauthorized" }, { status: 401 });
  return handleCreateToken(request, {
    env: process.env,
    store: tokenStoreForEnv(),
    now: () => Date.now(),
    subscriber,
  });
}

async function currentSubscriber() {
  const { actor } = await getContext();
  if (!actor) return null;
  return subscriberForActor(actor, tokenStoreForEnv());
}
