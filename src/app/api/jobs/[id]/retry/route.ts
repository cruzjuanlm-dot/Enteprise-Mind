import { after } from "next/server";
import { errorResponse, jsonOrRedirect } from "@/lib/http";
import { retryExtraction, runExtraction } from "@/lib/pipeline";
import { getContext } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { actor, repo } = await getContext();
    if (!actor) return jsonOrRedirect(request, 401, { error: "unauthorized" }, "/login", "/jobs");
    const { id } = await context.params;
    const job = await retryExtraction(repo, actor, id);
    after(() => {
      runExtraction(repo, job.id).catch((error: unknown) => {
        console.error(
          JSON.stringify({
            event: "extraction_crashed",
            jobId: job.id,
            name: error instanceof Error ? error.name : "error",
          }),
        );
      });
    });
    return jsonOrRedirect(request, 202, { jobId: job.id, jobStatus: "failed" }, "/jobs", "/jobs");
  } catch (error) {
    return errorResponse(request, error, "/jobs");
  }
}
