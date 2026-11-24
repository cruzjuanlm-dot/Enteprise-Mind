import { RecallError } from "./errors";

export const CREATE_BOT_ATTEMPTS = 2;
export const CREATE_BOT_BACKOFF_MS = 30_000;
export const JOIN_AT_LEAD_MS = 10 * 60 * 1000;
export const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;
export const RECALL_TIMEOUT_MS = 15_000;

export function requiredSecret(env: NodeJS.ProcessEnv, name: string, code: string): string {
  const value = env[name]?.trim() ?? "";
  if (!value) throw new RecallError(code, 503);
  return value;
}

export function recallRegion(env: NodeJS.ProcessEnv): string {
  return requiredSecret(env, "RECALL_REGION", "missing_recall_region");
}

export function recallApiKey(env: NodeJS.ProcessEnv): string {
  return requiredSecret(env, "RECALL_API_KEY", "missing_recall_api_key");
}

export function workspaceSecret(env: NodeJS.ProcessEnv): string {
  const secret = requiredSecret(env, "RECALL_WORKSPACE_SECRET", "missing_workspace_secret");
  if (!secret.startsWith("whsec_")) throw new RecallError("missing_workspace_secret", 503);
  return secret;
}

export function downloadHosts(env: NodeJS.ProcessEnv): string[] {
  const raw = requiredSecret(env, "RECALL_DOWNLOAD_HOSTS", "missing_download_hosts");
  const hosts = raw
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter((host) => host.length > 0);
  if (hosts.length === 0) throw new RecallError("missing_download_hosts", 503);
  return hosts;
}

export function assertRuleBasedExtraction(env: NodeJS.ProcessEnv): void {
  const flag = env.LLM_ENABLED?.trim().toLowerCase() ?? "";
  if (flag === "1" || flag === "true" || flag === "yes" || flag === "on") {
    throw new RecallError("llm_disabled_required", 503);
  }
}

export function githubToken(env: NodeJS.ProcessEnv): string {
  return env.FLUX_GITHUB_TOKEN?.trim() || env.GITHUB_TOKEN?.trim() || "";
}

export function botsAuthSecret(env: NodeJS.ProcessEnv): string {
  return requiredSecret(env, "FLUX_BOTS_AUTH_SECRET", "missing_bots_auth");
}
