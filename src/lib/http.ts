import { NextResponse } from "next/server";
import { AppError } from "./domain";

export function redirectTo(request: Request, path: string) {
  const url = new URL(path, request.url);
  return new NextResponse(null, {
    status: 303,
    headers: { Location: `${url.pathname}${url.search}` },
  });
}

export function wantsHtml(request: Request): boolean {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) return false;
  if (type.includes("form")) return true;
  return (request.headers.get("accept") ?? "").includes("text/html");
}

export function jsonOrRedirect(
  request: Request,
  status: number,
  body: { error?: string; jobId?: string; jobStatus?: string; transcriptId?: string; idempotent?: boolean },
  successPath: string,
  errorPath: string,
) {
  if (!wantsHtml(request)) return NextResponse.json(body, { status });
  const url = new URL(body.error ? errorPath : successPath, request.url);
  if (body.error) url.searchParams.set("error", body.error);
  return redirectTo(request, `${url.pathname}${url.search}`);
}

export function errorResponse(request: Request, error: unknown, errorPath: string) {
  if (!(error instanceof AppError)) {
    console.error(JSON.stringify({ event: "unhandled", name: error instanceof Error ? error.name : "error" }));
  }
  const code = error instanceof AppError ? error.code : "internal";
  const status = error instanceof AppError ? error.status : 500;
  return jsonOrRedirect(request, status, { error: code }, errorPath, errorPath);
}

export function stringField(form: FormData, key: string): string | null {
  const value = form.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
