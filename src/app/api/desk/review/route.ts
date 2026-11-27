import { approveDeskProposal, rejectDeskProposal, saveDeskProposal } from "@/lib/desk/store";
import { redirectTo, stringField } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData();
  const id = stringField(form, "proposalId") ?? "";
  const action = stringField(form, "action") ?? "";
  const patch = {
    title: stringField(form, "title") ?? undefined,
    type: stringField(form, "type") ?? undefined,
    body: stringField(form, "body") ?? undefined,
    scope: stringField(form, "scope") ?? undefined,
    domain: form.get("domain") === null ? undefined : String(form.get("domain") ?? ""),
    acceptance: form.get("acceptance") === null ? undefined : String(form.get("acceptance") ?? ""),
  };
  if (action === "reject") {
    const outcome = rejectDeskProposal(id);
    const code = outcome.ok ? "rejected" : outcome.reason;
    return redirectTo(request, `/proposals?result=${code}`);
  }
  if (action === "save") {
    const outcome = saveDeskProposal(id, patch);
    const code = outcome.ok ? "saved" : outcome.reason;
    return redirectTo(request, `/proposals?id=${id}&result=${code}`);
  }
  if (action === "approve") {
    const outcome = approveDeskProposal(id, patch);
    if (!outcome.ok) return redirectTo(request, `/proposals?id=${id}&error=${outcome.reason}`);
    return redirectTo(request, `/units/${outcome.value.id}?result=approved`);
  }
  return redirectTo(request, "/proposals?error=invalid");
}
