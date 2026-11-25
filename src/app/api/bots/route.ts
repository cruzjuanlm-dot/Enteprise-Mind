import { handleCreateBot } from "@/lib/recall/create-bot";
import { liveRecallDeps } from "@/lib/recall/runtime";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleCreateBot(request, liveRecallDeps());
}
