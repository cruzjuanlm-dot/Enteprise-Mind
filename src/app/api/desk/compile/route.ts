import { NextResponse } from "next/server";
import { compileTranscript } from "@/lib/desk/store";
import { PAYLOAD_LIMIT } from "@/lib/env";
import { redirectTo } from "@/lib/http";
import { detectFormat, normalizeTranscript } from "@/lib/normalize";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  let raw = "";
  if (file instanceof File && file.size > 0) {
    if (file.size > PAYLOAD_LIMIT) return redirectTo(request, "/compile?error=too_large");
    raw = await file.text();
  } else {
    const content = form.get("content");
    raw = typeof content === "string" ? content : "";
  }
  const normalized = normalizeTranscript(detectFormat(raw), raw);
  if (!normalized.ok) return redirectTo(request, `/compile?error=${normalized.reason}`);
  const outcome = compileTranscript(normalized.text);
  if (!outcome.ok) return redirectTo(request, `/compile?error=${outcome.reason ?? "empty"}`);
  const code = outcome.reason ?? "compiled";
  return redirectTo(request, `/proposals?result=${code}`);
}

export function GET() {
  return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
}
