import { NextResponse } from "next/server";
import { dataMode, LOCAL_COOKIE } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (dataMode() === "supabase") {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.cookies.set(LOCAL_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
