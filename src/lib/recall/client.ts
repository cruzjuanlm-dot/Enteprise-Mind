import { CREATE_BOT_ATTEMPTS, CREATE_BOT_BACKOFF_MS, RECALL_TIMEOUT_MS } from "./config";
import { RecallError } from "./errors";
import { recallBotUrl, recallTranscriptUrl } from "./region";

export type CreateBotPayload = {
  meeting_url: string;
  bot_name: string;
  join_at?: string;
  recording_config: {
    transcript: {
      provider: {
        recallai_streaming: Record<string, never>;
      };
    };
  };
};

export async function createRecallBot(input: {
  region: string;
  apiKey: string;
  payload: CreateBotPayload;
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
}): Promise<{ id: string }> {
  const url = recallBotUrl(input.region);
  for (let attempt = 1; attempt <= CREATE_BOT_ATTEMPTS; attempt += 1) {
    const response = await input.fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Token ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input.payload),
      signal: AbortSignal.timeout(RECALL_TIMEOUT_MS),
    });
    if (response.status === 507 && attempt < CREATE_BOT_ATTEMPTS) {
      await input.sleep(backoffMs(response));
      continue;
    }
    if (response.status === 507) throw new RecallError("recall_capacity", 507);
    if (!response.ok) throw new RecallError("recall_rejected", 502);
    const body = (await response.json()) as { id?: unknown };
    if (typeof body.id !== "string" || body.id.trim() === "") throw new RecallError("recall_rejected", 502);
    return { id: body.id };
  }
  throw new RecallError("recall_capacity", 507);
}

export async function fetchTranscriptDownload(input: {
  region: string;
  apiKey: string;
  transcriptId: string;
  hosts: string[];
  fetch: typeof fetch;
}): Promise<Uint8Array> {
  const meta = await input.fetch(recallTranscriptUrl(input.region, input.transcriptId), {
    method: "GET",
    headers: { Authorization: `Token ${input.apiKey}` },
    signal: AbortSignal.timeout(RECALL_TIMEOUT_MS),
  });
  if (!meta.ok) throw new RecallError("transcript_fetch_failed", 502);
  const body = (await meta.json()) as { data?: { download_url?: unknown } };
  const downloadUrl = body.data?.download_url;
  if (typeof downloadUrl !== "string") throw new RecallError("transcript_fetch_failed", 502);
  const allowed = assertDownloadUrl(downloadUrl, input.hosts);
  const file = await input.fetch(allowed.toString(), {
    method: "GET",
    redirect: "manual",
    signal: AbortSignal.timeout(RECALL_TIMEOUT_MS),
  });
  if (file.status >= 300 && file.status < 400) throw new RecallError("download_rejected", 502);
  if (!file.ok) throw new RecallError("download_rejected", 502);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength > 2_000_000) throw new RecallError("download_rejected", 502);
  return bytes;
}

export function assertDownloadUrl(raw: string, hosts: string[]): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new RecallError("download_rejected", 502);
  }
  if (url.protocol !== "https:") throw new RecallError("download_rejected", 502);
  if (url.username || url.password) throw new RecallError("download_rejected", 502);
  if (url.port && url.port !== "443") throw new RecallError("download_rejected", 502);
  if (!hosts.includes(url.hostname.toLowerCase())) throw new RecallError("download_rejected", 502);
  return url;
}

function backoffMs(response: Response): number {
  const header = response.headers.get("retry-after");
  if (header && /^\d+$/.test(header)) {
    const seconds = Number(header);
    if (seconds >= 1 && seconds <= 120) return seconds * 1000;
  }
  return CREATE_BOT_BACKOFF_MS;
}
