import { randomUUID } from "node:crypto";
import {
  ACTIVE_TOKEN_ID,
  ALL_SCOPES,
  HEARTHLINE_ADMIN_ID,
  HEARTHLINE_EDITOR_ID,
  HEARTHLINE_WORKSPACE_ID,
  REVOKED_TOKEN_ID,
  SEEDED_TOKEN_HASHES,
  SEEDED_TOKEN_LAST4,
} from "./seed-meta";
import {
  assertAuditDetail,
  toTokenMetadata,
  type AuditEntry,
  type SubscriberRecord,
  type TokenMetadata,
  type TokenRecord,
  type TokenStore,
  type WorkspaceRecord,
} from "./store";
import { TOKEN_PREFIX } from "./crypto";

const SEEDED_AT = "2026-11-20T15:00:00.000Z";
const REVOKED_AT = "2026-11-21T15:00:00.000Z";
const EXPIRES_AT = "2036-11-24T00:00:00.000Z";

export function seededSubscribers(): SubscriberRecord[] {
  return [
    {
      id: HEARTHLINE_ADMIN_ID,
      workspaceId: HEARTHLINE_WORKSPACE_ID,
      displayName: "Workspace admin",
      email: "workspace-admin@hearthline.test",
      role: "admin",
    },
    {
      id: HEARTHLINE_EDITOR_ID,
      workspaceId: HEARTHLINE_WORKSPACE_ID,
      displayName: "Catalog editor",
      email: "catalog-editor@hearthline.test",
      role: "member",
    },
  ];
}

export function seededTokens(): TokenRecord[] {
  return [
    {
      id: ACTIVE_TOKEN_ID,
      subscriberId: HEARTHLINE_ADMIN_ID,
      workspaceId: HEARTHLINE_WORKSPACE_ID,
      label: "Catalog and meetings",
      tokenHash: SEEDED_TOKEN_HASHES.active,
      prefix: TOKEN_PREFIX,
      last4: SEEDED_TOKEN_LAST4.active,
      scopes: [...ALL_SCOPES],
      expiresAt: EXPIRES_AT,
      revokedAt: null,
      lastUsedAt: null,
      createdAt: SEEDED_AT,
    },
    {
      id: REVOKED_TOKEN_ID,
      subscriberId: HEARTHLINE_ADMIN_ID,
      workspaceId: HEARTHLINE_WORKSPACE_ID,
      label: "Retired catalog reader",
      tokenHash: SEEDED_TOKEN_HASHES.revoked,
      prefix: TOKEN_PREFIX,
      last4: SEEDED_TOKEN_LAST4.revoked,
      scopes: ["units:read"],
      expiresAt: EXPIRES_AT,
      revokedAt: REVOKED_AT,
      lastUsedAt: null,
      createdAt: SEEDED_AT,
    },
  ];
}

export function seededAudit(): AuditEntry[] {
  return [
    audit("audit.token-active-create", "token.create", ACTIVE_TOKEN_ID, SEEDED_TOKEN_LAST4.active, SEEDED_AT),
    audit("audit.token-revoked-create", "token.create", REVOKED_TOKEN_ID, SEEDED_TOKEN_LAST4.revoked, SEEDED_AT),
    audit("audit.token-revoked", "token.revoke", REVOKED_TOKEN_ID, SEEDED_TOKEN_LAST4.revoked, REVOKED_AT),
  ];
}

function audit(
  id: string,
  action: "token.create" | "token.revoke",
  target: string,
  last4: string,
  createdAt: string,
): AuditEntry {
  return {
    id,
    actorSubscriberId: HEARTHLINE_ADMIN_ID,
    action,
    target,
    detail: { prefix: TOKEN_PREFIX, last4 },
    createdAt,
  };
}

export class MemoryTokenStore implements TokenStore {
  private readonly tokens = new Map<string, TokenRecord>();
  private readonly audit: AuditEntry[] = [];
  private readonly subscribers: SubscriberRecord[];
  private readonly workspaces: WorkspaceRecord[];

  constructor(options?: { seed?: boolean }) {
    const seed = options?.seed !== false;
    this.workspaces = seed
      ? [{ id: HEARTHLINE_WORKSPACE_ID, name: "Hearthline Instruments", slug: "hearthline" }]
      : [];
    this.subscribers = seed ? seededSubscribers() : [];
    if (seed) {
      for (const token of seededTokens()) this.tokens.set(token.id, structuredClone(token));
      this.audit.push(...seededAudit());
    }
  }

  async insert(record: TokenRecord): Promise<void> {
    this.tokens.set(record.id, { ...record, scopes: [...record.scopes] });
  }

  async findByHash(hash: string): Promise<TokenRecord | null> {
    for (const record of this.tokens.values()) {
      if (record.tokenHash === hash) return { ...record, scopes: [...record.scopes] };
    }
    return null;
  }

  async listBySubscriber(subscriberId: string): Promise<TokenMetadata[]> {
    return [...this.tokens.values()]
      .filter((record) => record.subscriberId === subscriberId)
      .map(toTokenMetadata);
  }

  async listAllMetadata(): Promise<TokenMetadata[]> {
    return [...this.tokens.values()].map(toTokenMetadata);
  }

  async revoke(id: string, subscriberId: string, revokedAt: string): Promise<TokenMetadata | null> {
    const record = this.tokens.get(id);
    if (!record || record.subscriberId !== subscriberId) return null;
    record.revokedAt = revokedAt;
    return toTokenMetadata(record);
  }

  async revokeById(id: string, revokedAt: string): Promise<TokenMetadata | null> {
    const record = this.tokens.get(id);
    if (!record) return null;
    record.revokedAt = revokedAt;
    return toTokenMetadata(record);
  }

  async touchLastUsed(id: string, at: string): Promise<void> {
    const record = this.tokens.get(id);
    if (record) record.lastUsedAt = at;
  }

  async appendAudit(entry: AuditEntry): Promise<void> {
    assertAuditDetail(entry.detail);
    this.audit.push(entry);
  }

  async listAudit(): Promise<AuditEntry[]> {
    return this.audit.map((entry) => ({ ...entry, detail: { ...entry.detail } }));
  }

  async getSubscriber(id: string): Promise<SubscriberRecord | null> {
    return this.subscribers.find((subscriber) => subscriber.id === id) ?? null;
  }

  async findSubscriberByEmail(email: string): Promise<SubscriberRecord | null> {
    const needle = email.trim().toLowerCase();
    return this.subscribers.find((subscriber) => subscriber.email === needle) ?? null;
  }

  async listSubscribers(): Promise<SubscriberRecord[]> {
    return this.subscribers.map((subscriber) => ({ ...subscriber }));
  }

  async listWorkspaces(): Promise<WorkspaceRecord[]> {
    return this.workspaces.map((workspace) => ({ ...workspace }));
  }

  async hasAdminRole(subscriberId: string): Promise<boolean> {
    return this.subscribers.some((subscriber) => subscriber.id === subscriberId && subscriber.role === "admin");
  }
}

export function newAuditId(): string {
  return `audit.${randomUUID()}`;
}
