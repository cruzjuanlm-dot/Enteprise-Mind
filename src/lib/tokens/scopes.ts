export const TOKEN_SCOPES = ["units:read", "entities:read", "meetings:write", "action_items:read"] as const;

export type TokenScope = (typeof TOKEN_SCOPES)[number];

const SCOPE_SET = new Set<string>(TOKEN_SCOPES);

export function isTokenScope(value: string): value is TokenScope {
  return SCOPE_SET.has(value);
}

export function parseScopes(input: unknown): TokenScope[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;
  const scopes: TokenScope[] = [];
  for (const item of input) {
    if (typeof item !== "string" || !isTokenScope(item)) return null;
    if (!scopes.includes(item)) scopes.push(item);
  }
  return scopes;
}
