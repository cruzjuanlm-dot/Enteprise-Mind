import { workspaceSecret } from "./config";
import type { RecallDeps } from "./deps";
import { recallErrorResponse } from "./http";
import { parseRecallEvent, processRecallEvent } from "./jobs";
import { verifyRecallSignature } from "./signature";

export async function handleRecallWebhook(request: Request, deps: RecallDeps): Promise<Response> {
  try {
    const rawBody = await request.text();
    const secret = workspaceSecret(deps.env);
    verifyRecallSignature({ secret, headers: request.headers, rawBody, nowMs: deps.now() });
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody) as unknown;
    } catch {
      return Response.json({ error: "invalid_payload" }, { status: 400 });
    }
    const webhookId = request.headers.get("webhook-id") ?? request.headers.get("svix-id") ?? "";
    const event = parseRecallEvent(payload, webhookId);
    if (event) {
      deps.schedule(() =>
        processRecallEvent(event, deps).catch((error: unknown) => {
          console.error(
            JSON.stringify({
              event: "recall_job_failed",
              name: error instanceof Error ? error.name : "error",
              code: error instanceof Error && "code" in error && typeof error.code === "string" ? error.code : "error",
            }),
          );
        }),
      );
    }
    return Response.json({ ok: true }, { status: 200 });
  } catch (error) {
    return recallErrorResponse(error);
  }
}
