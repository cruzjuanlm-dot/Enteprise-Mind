import { after } from "next/server";
import { AppError } from "@/lib/domain";
import { errorResponse, jsonOrRedirect, stringField } from "@/lib/http";
import { ingest, runExtraction, type IngestInput } from "@/lib/pipeline";
import { getContext } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { actor, repo } = await getContext();
    if (!actor) throw new AppError("unauthorized", 401);
    const input = await readInput(request);
    const result = await ingest(repo, actor, input);
    if (result.enqueueJobId) {
      const jobId = result.enqueueJobId;
      after(() => {
        runExtraction(repo, jobId).catch((error: unknown) => {
          console.error(
            JSON.stringify({
              event: "extraction_crashed",
              jobId,
              name: error instanceof Error ? error.name : "error",
            }),
          );
        });
      });
    }
    return jsonOrRedirect(request, result.status, result.body, "/review", "/ingest");
  } catch (error) {
    return errorResponse(request, error, "/ingest");
  }
}

async function readInput(request: Request): Promise<IngestInput> {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const body = (await request.json()) as IngestInput;
    if (!body || typeof body !== "object") throw new AppError("invalid_format", 400);
    return body;
  }
  const form = await request.formData();
  return {
    tenantSlug: stringField(form, "tenantSlug") ?? undefined,
    sourceSystem: stringField(form, "sourceSystem") ?? undefined,
    sourceExternalId: stringField(form, "sourceExternalId"),
    title: stringField(form, "title"),
    projectId: stringField(form, "projectId"),
    content: stringField(form, "content") ?? "",
    format: "text",
  };
}
