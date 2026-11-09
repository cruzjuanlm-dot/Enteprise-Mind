import { cookies } from "next/headers";
import type { Actor } from "./domain";
import { dataMode, LOCAL_COOKIE, type DataMode } from "./env";
import { getMemoryRepository } from "./memory-repository";
import type { Repository } from "./repository";
import { createServiceClient, createSupabaseServerClient } from "./supabase";
import { SupabaseRepository } from "./supabase-repository";

export async function getContext(): Promise<{ mode: DataMode; actor: Actor | null; repo: Repository }> {
  const mode = dataMode();
  if (mode === "memory") {
    const repo = getMemoryRepository();
    return { mode, actor: await memoryActor(repo), repo };
  }
  const userClient = await createSupabaseServerClient();
  const repo = new SupabaseRepository(createServiceClient(), userClient);
  const { data } = await userClient.auth.getUser();
  if (!data.user) return { mode, actor: null, repo };
  const actor = await repo.actorFor(data.user.id);
  if (!actor) return { mode, actor: null, repo };
  actor.email = data.user.email ?? "";
  return { mode, actor, repo };
}

async function memoryActor(repo: Repository): Promise<Actor | null> {
  const jar = await cookies();
  const id = jar.get(LOCAL_COOKIE)?.value;
  if (!id) return null;
  return repo.actorFor(id);
}
