import { cookies } from "next/headers";
import { handleAdminRevoke } from "@/lib/admin/http";
import { ADMIN_COOKIE } from "@/lib/admin/gate";
import { tokenStoreForEnv } from "@/lib/tokens/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const jar = await cookies();
  return handleAdminRevoke(request, {
    env: process.env,
    store: tokenStoreForEnv(),
    now: () => Date.now(),
    authorizationHeader: request.headers.get("authorization"),
    adminCookie: jar.get(ADMIN_COOKIE)?.value ?? null,
  });
}
