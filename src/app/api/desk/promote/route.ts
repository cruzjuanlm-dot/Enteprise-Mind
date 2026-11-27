import { promoteDeskUnit } from "@/lib/desk/store";
import { redirectTo, stringField } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData();
  const id = stringField(form, "unitId") ?? "";
  const domain = stringField(form, "domain") ?? "";
  const outcome = promoteDeskUnit(id, domain);
  if (!outcome.ok) return redirectTo(request, `/units/${id}?error=${outcome.reason}`);
  return redirectTo(request, `/units/${id}?result=promoted`);
}
