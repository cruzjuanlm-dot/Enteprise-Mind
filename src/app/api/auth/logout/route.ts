import { NextResponse } from "next/server";
import { dataMode, LOCAL_COOKIE } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST() {
  if (dataMode() === "supabase") {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  const response = new NextResponse(null, { status: 303, headers: { Location: "/" } });
  response.cookies.set(LOCAL_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
