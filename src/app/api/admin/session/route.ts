import { handleAdminSession } from "@/lib/admin/http";
import { tokenStoreForEnv } from "@/lib/tokens/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleAdminSession(request, {
    env: process.env,
    store: tokenStoreForEnv(),
    now: () => Date.now(),
  });
}
