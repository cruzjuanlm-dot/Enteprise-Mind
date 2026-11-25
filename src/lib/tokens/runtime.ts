import { dataMode } from "../env";
import { MemoryTokenStore } from "./memory-store";
import { supabaseTokenStore } from "./supabase-store";
import type { TokenStore } from "./store";

let shared: MemoryTokenStore | null = null;

export function sharedTokenStore(): MemoryTokenStore {
  shared ??= new MemoryTokenStore();
  return shared;
}

export function tokenStoreForEnv(): TokenStore {
  if (dataMode() === "supabase") return supabaseTokenStore();
  return sharedTokenStore();
}
