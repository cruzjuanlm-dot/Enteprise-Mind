import { createServiceClient } from "../supabase";
import { TokenAuthError } from "./crypto";
import type { TokenScope } from "./scopes";
import {
  toTokenMetadata,
  type AuditAction,
  type AuditEntry,
  type SubscriberRecord,
  type TokenRecord,
  type TokenStore,
  type WorkspaceRecord,
} from "./store";

const META =
  "id, subscriber_id, workspace_id, label, prefix, last4, scopes, expires_at, revoked_at, last_used_at, created_at";

export function supabaseTokenStore(client = createServiceClient()): TokenStore {
  return {
    async insert(record) {
      const { error } = await client.from("api_tokens").insert(tokenRow(record));
      if (error) throw new TokenAuthError("token_store_failed", 503);
    },
    async findByHash(hash) {
      const { data, error } = await client.from("api_tokens").select(`${META}, token_hash`).eq("token_hash", hash).limit(1);
      if (error) throw new TokenAuthError("token_store_failed", 503);
      const row = data?.[0];
      return row ? toRecord(row as Row) : null;
    },
    async listBySubscriber(subscriberId) {
      const { data, error } = await client.from("api_tokens").select(META).eq("subscriber_id", subscriberId).order("created_at");
      if (error) throw new TokenAuthError("token_store_failed", 503);
      return (data ?? []).map((row) => toTokenMetadata(toRecord(row as Row)));
    },
    async listAllMetadata() {
      const { data, error } = await client.from("api_tokens").select(META).order("created_at");
      if (error) throw new TokenAuthError("token_store_failed", 503);
      return (data ?? []).map((row) => toTokenMetadata(toRecord(row as Row)));
    },
    async revoke(id, subscriberId, revokedAt) {
      const { data, error } = await client
        .from("api_tokens")
        .update({ revoked_at: revokedAt })
        .eq("id", id)
        .eq("subscriber_id", subscriberId)
        .select(META);
      if (error) throw new TokenAuthError("token_store_failed", 503);
      const row = data?.[0];
      return row ? toTokenMetadata(toRecord(row as Row)) : null;
    },
    async revokeById(id, revokedAt) {
      const { data, error } = await client.from("api_tokens").update({ revoked_at: revokedAt }).eq("id", id).select(META);
      if (error) throw new TokenAuthError("token_store_failed", 503);
      const row = data?.[0];
      return row ? toTokenMetadata(toRecord(row as Row)) : null;
    },
    async touchLastUsed(id, at) {
      const { error } = await client.from("api_tokens").update({ last_used_at: at }).eq("id", id);
      if (error) throw new TokenAuthError("token_store_failed", 503);
    },
    async appendAudit(entry) {
      const { error } = await client.from("audit_log").insert({
        id: entry.id,
        actor_subscriber_id: entry.actorSubscriberId,
        action: entry.action,
        target: entry.target,
        detail: entry.detail,
        created_at: entry.createdAt,
      });
      if (error) throw new TokenAuthError("token_store_failed", 503);
    },
    async listAudit() {
      const { data, error } = await client.from("audit_log").select("id, actor_subscriber_id, action, target, detail, created_at").order("created_at");
      if (error) throw new TokenAuthError("token_store_failed", 503);
      return (data ?? []).map((row) => {
        const record = row as Record<string, unknown>;
        return {
          id: String(record.id),
          actorSubscriberId: record.actor_subscriber_id ? String(record.actor_subscriber_id) : null,
          action: String(record.action) as AuditAction,
          target: String(record.target),
          detail: (record.detail ?? {}) as Record<string, unknown>,
          createdAt: String(record.created_at),
        } satisfies AuditEntry;
      });
    },
    async getSubscriber(id) {
      return oneSubscriber(client, "id", id);
    },
    async findSubscriberByEmail(email) {
      return oneSubscriber(client, "email", email.trim().toLowerCase());
    },
    async listSubscribers() {
      const { data, error } = await client.from("subscribers").select("id, workspace_id, display_name, email").order("id");
      if (error) throw new TokenAuthError("token_store_failed", 503);
      const roles = await adminIds(client);
      return (data ?? []).map((row) => toSubscriber(row as Record<string, unknown>, roles));
    },
    async listWorkspaces() {
      const { data, error } = await client.from("workspaces").select("id, name, slug").order("id");
      if (error) throw new TokenAuthError("token_store_failed", 503);
      return (data ?? []).map((row) => {
        const record = row as Record<string, unknown>;
        return { id: String(record.id), name: String(record.name), slug: String(record.slug) } satisfies WorkspaceRecord;
      });
    },
    async hasAdminRole(subscriberId) {
      const { data, error } = await client.from("admin_roles").select("subscriber_id").eq("subscriber_id", subscriberId).limit(1);
      if (error) throw new TokenAuthError("token_store_failed", 503);
      return (data ?? []).length > 0;
    },
  };
}

type Row = Record<string, unknown>;

function tokenRow(record: TokenRecord): Record<string, unknown> {
  return {
    id: record.id,
    subscriber_id: record.subscriberId,
    workspace_id: record.workspaceId,
    label: record.label,
    token_hash: record.tokenHash,
    prefix: record.prefix,
    last4: record.last4,
    scopes: record.scopes,
    expires_at: record.expiresAt,
    revoked_at: record.revokedAt,
    last_used_at: record.lastUsedAt,
    created_at: record.createdAt,
  };
}

function toRecord(row: Row): TokenRecord {
  return {
    id: String(row.id),
    subscriberId: String(row.subscriber_id),
    workspaceId: String(row.workspace_id),
    label: String(row.label),
    tokenHash: String(row.token_hash ?? ""),
    prefix: String(row.prefix),
    last4: String(row.last4),
    scopes: Array.isArray(row.scopes) ? (row.scopes.filter((item) => typeof item === "string") as TokenScope[]) : [],
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    revokedAt: row.revoked_at ? String(row.revoked_at) : null,
    lastUsedAt: row.last_used_at ? String(row.last_used_at) : null,
    createdAt: String(row.created_at),
  };
}

async function adminIds(client: ReturnType<typeof createServiceClient>): Promise<Set<string>> {
  const { data, error } = await client.from("admin_roles").select("subscriber_id");
  if (error) throw new TokenAuthError("token_store_failed", 503);
  return new Set((data ?? []).map((row) => String((row as Row).subscriber_id)));
}

function toSubscriber(row: Row, roles: Set<string>): SubscriberRecord {
  const id = String(row.id);
  return {
    id,
    workspaceId: String(row.workspace_id),
    displayName: String(row.display_name),
    email: String(row.email),
    role: roles.has(id) ? "admin" : "member",
  };
}

async function oneSubscriber(
  client: ReturnType<typeof createServiceClient>,
  column: "id" | "email",
  value: string,
): Promise<SubscriberRecord | null> {
  const { data, error } = await client.from("subscribers").select("id, workspace_id, display_name, email").eq(column, value).limit(1);
  if (error) throw new TokenAuthError("token_store_failed", 503);
  const row = data?.[0] as Row | undefined;
  if (!row) return null;
  const roles = await adminIds(client);
  return toSubscriber(row, roles);
}

export const TOKEN_METADATA_COLUMNS = META;
