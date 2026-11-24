import { RecallError } from "./errors";

export function recallErrorResponse(error: unknown): Response {
  if (error instanceof RecallError) {
    return Response.json({ error: error.code }, { status: error.status });
  }
  console.error(JSON.stringify({ event: "recall_unhandled", name: error instanceof Error ? error.name : "error" }));
  return Response.json({ error: "internal" }, { status: 500 });
}
