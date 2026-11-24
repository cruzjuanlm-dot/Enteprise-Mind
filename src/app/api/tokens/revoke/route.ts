import { handleRevokeToken } from "@/lib/tokens/handlers";
import { tokenStoreForEnv } from "@/lib/tokens/runtime";
import { subscriberForActor } from "@/lib/tokens/session";
import { getContext } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { actor } = await getContext();
  const subscriber = await subscriberForActor(actor, tokenStoreForEnv());
  if (!subscriber) return Response.json({ error: "unauthorized" }, { status: 401 });
  return handleRevokeToken(request, {
    env: process.env,
    store: tokenStoreForEnv(),
    now: () => Date.now(),
    subscriber,
  });
}
