import { AppError } from "@/lib/domain";
import { errorResponse, jsonOrRedirect, stringField } from "@/lib/http";
import { getContext } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { actor, repo } = await getContext();
    if (!actor) throw new AppError("unauthorized", 401);
    const { unitId, action } = await readReview(request);
    if (action !== "accept" && action !== "reject") throw new AppError("invalid_action", 400);
    await repo.reviewUnit(actor, unitId, action);
    return jsonOrRedirect(request, 200, {}, "/review", "/review");
  } catch (error) {
    return errorResponse(request, error, "/review");
  }
}

async function readReview(request: Request): Promise<{ unitId: string; action: string }> {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const body = (await request.json()) as { unitId?: string; action?: string };
    return { unitId: body.unitId?.trim() ?? "", action: body.action?.trim() ?? "" };
  }
  const form = await request.formData();
  return {
    unitId: stringField(form, "unitId") ?? "",
    action: stringField(form, "action") ?? "",
  };
}
