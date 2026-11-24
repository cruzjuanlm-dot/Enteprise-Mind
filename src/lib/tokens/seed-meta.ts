import type { TokenScope } from "./scopes";

export const HEARTHLINE_WORKSPACE_ID = "workspace.hearthline";
export const HEARTHLINE_ADMIN_ID = "subscriber.hearthline-admin";
export const HEARTHLINE_EDITOR_ID = "subscriber.hearthline-editor";
export const ACTIVE_TOKEN_ID = "token.hearthline-active";
export const REVOKED_TOKEN_ID = "token.hearthline-revoked";

export const SEEDED_TOKEN_HASHES = {
  active: "72bbb9089368df298a0e1d969e88a35c4f8da108c0009dac3e2219c690d425ff",
  revoked: "56c0a5cf5f9c143818889a3f925ddaad3f3cc447f7c56963861e4c5d88781229",
} as const;

export const SEEDED_TOKEN_LAST4 = {
  active: "LHpU",
  revoked: "q7A8",
} as const;

export const ALL_SCOPES: TokenScope[] = ["units:read", "entities:read", "meetings:write", "action_items:read"];
