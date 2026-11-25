import { liveRecallDeps } from "@/lib/recall/runtime";
import { handleRecallWebhook } from "@/lib/recall/webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleRecallWebhook(request, liveRecallDeps());
}
