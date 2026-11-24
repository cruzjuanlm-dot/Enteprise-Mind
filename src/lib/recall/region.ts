import { RecallError } from "./errors";

/**
 * The only place a Recall.ai API origin is built.
 * Callers append /api/v1/... to this origin. RECALL_REGION is a slug such as us-east-1.
 */
export function recallApiOrigin(region: string): string {
  const normalized = region.trim().toLowerCase();
  if (!/^[a-z][a-z0-9-]{1,40}$/.test(normalized)) {
    throw new RecallError("missing_recall_region", 503);
  }
  return `https://${normalized}.recall.ai`;
}

export function recallBotUrl(region: string): string {
  return `${recallApiOrigin(region)}/api/v1/bot/`;
}

export function recallTranscriptUrl(region: string, transcriptId: string): string {
  return `${recallApiOrigin(region)}/api/v1/transcript/${encodeURIComponent(transcriptId)}/`;
}
