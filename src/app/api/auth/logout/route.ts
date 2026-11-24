import { NextResponse } from "next/server";
import { dataMode, LOCAL_COOKIE } from "@/lib/env";
import { sameOriginUrl } from "@/lib/http";
import { createSupabaseServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (dataMode() === "supabase") {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  const response = new NextResponse(null, {
    status: 303,
    headers: { location: sameOriginUrl(request, "/").toString() },
  });
  response.cookies.set(LOCAL_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
