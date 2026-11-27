import { reviseDeskUnit } from "@/lib/desk/store";
import { redirectTo, stringField } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData();
  const id = stringField(form, "unitId") ?? "";
  const outcome = reviseDeskUnit(id, {
    title: stringField(form, "title") ?? undefined,
    body: stringField(form, "body") ?? undefined,
  });
  if (!outcome.ok) return redirectTo(request, `/units/${id}?error=${outcome.reason}`);
  return redirectTo(request, `/units/${id}?result=revised`);
}
