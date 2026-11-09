import { NextResponse } from "next/server";
import { dataMode, LOCAL_COOKIE } from "@/lib/env";
import { findLocalAccount } from "@/lib/fixtures";
import { stringField } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (dataMode() !== "memory") {
    return NextResponse.json({ error: "local_auth_disabled" }, { status: 404 });
  }
  const form = await request.formData();
  const email = stringField(form, "email") ?? "";
  const account = findLocalAccount(email);
  if (!account) return NextResponse.json({ error: "unknown_local_user" }, { status: 400 });
  const response = NextResponse.redirect(new URL("/review", request.url), 303);
  response.cookies.set(LOCAL_COOKIE, account.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  return response;
}
