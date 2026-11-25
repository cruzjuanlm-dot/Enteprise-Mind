import Link from "next/link";
import { getContext } from "@/lib/session";
import { TOKEN_SCOPES } from "@/lib/tokens/scopes";
import { tokenStoreForEnv } from "@/lib/tokens/runtime";
import { subscriberForActor } from "@/lib/tokens/session";
import type { TokenMetadata } from "@/lib/tokens/store";

export const dynamic = "force-dynamic";

export default async function TokensPage() {
  const { actor } = await getContext();
  const subscriber = await subscriberForActor(actor, tokenStoreForEnv());
  const tokens = subscriber ? await tokenStoreForEnv().listBySubscriber(subscriber.id) : [];

  return (
    <main className="grid gap-4">
      <section className="panel p-4">
        <h1 className="text-2xl">API tokens</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Personal tokens start with <span className="font-medium">flux_</span>. The plaintext is shown once. The server stores an HMAC-SHA256 hash, the prefix, and the last four characters.
        </p>
        {!actor ? (
          <p className="mt-4 text-sm">
            <Link className="btn" href="/login">
              Sign in
            </Link>
          </p>
        ) : null}
        {actor && !subscriber ? (
          <p className="mt-4 text-sm">This sign-in is not a Hearthline subscriber, so it cannot create tokens.</p>
        ) : null}
      </section>
      {subscriber ? (
        <>
          <section className="panel p-4">
            <h2 className="text-xl">New token</h2>
            <form className="mt-3 grid gap-3" action="/api/tokens" method="post">
              <label className="field">
                <span>Label</span>
                <input name="label" maxLength={80} placeholder="Bench reader" />
              </label>
              <fieldset className="grid gap-2 text-sm">
                <legend className="text-[var(--muted)]">Scopes</legend>
                {TOKEN_SCOPES.map((scope) => (
                  <label key={scope} className="flex items-center gap-2">
                    <input className="h-4 w-4" type="checkbox" name="scopes" value={scope} />
                    <span>{scope}</span>
                  </label>
                ))}
              </fieldset>
              <label className="field">
                <span>Expiry</span>
                <input name="expiresAt" type="date" />
              </label>
              <button className="btn w-fit" type="submit">
                Create token
              </button>
            </form>
          </section>
          <section className="panel p-4">
            <h2 className="mb-3 text-xl">Your tokens</h2>
            {tokens.length === 0 ? <p className="text-sm">No tokens yet.</p> : <TokenList rows={tokens} />}
          </section>
        </>
      ) : null}
    </main>
  );
}

function TokenList({ rows }: { rows: TokenMetadata[] }) {
  return (
    <ul className="grid gap-3 text-sm">
      {rows.map((row) => (
        <li key={row.id} className="border-t border-[var(--line)] pt-3 first:border-t-0 first:pt-0">
          <div className="font-medium">
            {row.prefix}…{row.last4}
          </div>
          <div>{row.label}</div>
          <div className="break-words">{row.scopes.join(", ")}</div>
          <div className="text-[var(--muted)]">
            Created {row.createdAt.slice(0, 16).replace("T", " ")} · last used{" "}
            {row.lastUsedAt ? row.lastUsedAt.slice(0, 16).replace("T", " ") : "never"} ·{" "}
            {row.revokedAt ? "revoked" : `expires ${row.expiresAt ? row.expiresAt.slice(0, 10) : "—"}`}
          </div>
          {row.revokedAt ? null : (
            <form className="mt-2" action="/api/tokens/revoke" method="post">
              <input type="hidden" name="id" value={row.id} />
              <button className="btn danger" type="submit">
                Revoke
              </button>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}
