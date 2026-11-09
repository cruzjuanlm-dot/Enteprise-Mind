export type DataMode = "memory" | "supabase";

const PLACEHOLDER = /placeholder|your-project|example\.supabase|changeme|xxxxx/i;

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!url || !anon || !service) return false;
  if (PLACEHOLDER.test(url) || PLACEHOLDER.test(anon) || PLACEHOLDER.test(service)) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  } catch {
    return false;
  }
  return true;
}

export function dataMode(): DataMode {
  const forced = process.env.ENTERPRISE_MIND_DATA_MODE?.trim();
  if (forced === "memory") {
    if (process.env.VERCEL_ENV === "production") {
      throw new Error("Memory mode is refused when VERCEL_ENV=production.");
    }
    return "memory";
  }
  if (forced === "supabase") {
    if (!isSupabaseConfigured()) {
      throw new Error("ENTERPRISE_MIND_DATA_MODE=supabase requires the Supabase environment variables.");
    }
    return "supabase";
  }
  if (isSupabaseConfigured()) return "supabase";
  if (process.env.VERCEL_ENV === "production") {
    throw new Error("Supabase environment variables are required when VERCEL_ENV=production.");
  }
  return "memory";
}

export const LOCAL_COOKIE = "em_local_user";
export const PAYLOAD_LIMIT = 500_000;
