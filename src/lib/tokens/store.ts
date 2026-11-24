import type { TokenScope } from "./scopes";

export type WorkspaceRecord = {
  id: string;
  name: string;
  slug: string;
};

export type SubscriberRecord = {
  id: string;
  workspaceId: string;
  displayName: string;
  email: string;
  role: "admin" | "member";
};

export type TokenRecord = {
  id: string;
  subscriberId: string;
  workspaceId: string;
  label: string;
  tokenHash: string;
  prefix: string;
  last4: string;
  scopes: TokenScope[];
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
};

export type TokenMetadata = Omit<TokenRecord, "tokenHash">;

export type AuditAction = "token.create" | "token.revoke" | "admin.view" | "admin.session";

export type AuditEntry = {
  id: string;
  actorSubscriberId: string | null;
  action: AuditAction;
  target: string;
  detail: Record<string, unknown>;
  createdAt: string;
};

export function toTokenMetadata(record: TokenRecord): TokenMetadata {
  const metadata: TokenMetadata = {
    id: record.id,
    subscriberId: record.subscriberId,
    workspaceId: record.workspaceId,
    label: record.label,
    prefix: record.prefix,
    last4: record.last4,
    scopes: record.scopes,
    expiresAt: record.expiresAt,
    revokedAt: record.revokedAt,
    lastUsedAt: record.lastUsedAt,
    createdAt: record.createdAt,
  };
  return metadata;
}

const FORBIDDEN_DETAIL = /flux_[A-Za-z0-9_-]{8,}/;
const FORBIDDEN_KEYS = new Set(["plaintext", "token", "secret", "token_hash", "authorization", "pepper"]);

export function assertAuditDetail(detail: Record<string, unknown>): void {
  for (const key of Object.keys(detail)) {
    if (FORBIDDEN_KEYS.has(key)) throw new TokenAuditError();
  }
  if (FORBIDDEN_DETAIL.test(JSON.stringify(detail))) throw new TokenAuditError();
}

export class TokenAuditError extends Error {
  constructor() {
    super("audit_detail_rejected");
    this.name = "TokenAuditError";
  }
}

export interface TokenStore {
  insert(record: TokenRecord): Promise<void>;
  findByHash(hash: string): Promise<TokenRecord | null>;
  listBySubscriber(subscriberId: string): Promise<TokenMetadata[]>;
  listAllMetadata(): Promise<TokenMetadata[]>;
  revoke(id: string, subscriberId: string, revokedAt: string): Promise<TokenMetadata | null>;
  revokeById(id: string, revokedAt: string): Promise<TokenMetadata | null>;
  touchLastUsed(id: string, at: string): Promise<void>;
  appendAudit(entry: AuditEntry): Promise<void>;
  listAudit(): Promise<AuditEntry[]>;
  getSubscriber(id: string): Promise<SubscriberRecord | null>;
  findSubscriberByEmail(email: string): Promise<SubscriberRecord | null>;
  listSubscribers(): Promise<SubscriberRecord[]>;
  listWorkspaces(): Promise<WorkspaceRecord[]>;
  hasAdminRole(subscriberId: string): Promise<boolean>;
}
