import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/admin/gate";
import { buildAdminView, SEEDED_ADMIN_BOTS, type AdminBotRow } from "@/lib/admin/view";
import { deskSettings } from "@/lib/desk/settings";
import { dataMode } from "@/lib/env";
import { recallStoreForEnv } from "@/lib/recall/store";
import { createServiceClient } from "@/lib/supabase";
import { seededSubscribers, seededTokens } from "@/lib/tokens/memory-store";
import { tokenStoreForEnv } from "@/lib/tokens/runtime";
import { toTokenMetadata, type SubscriberRecord, type TokenMetadata, type WorkspaceRecord } from "@/lib/tokens/store";
import type { SubscriptionRow } from "@/lib/admin/view";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const jar = await cookies();
  const view = await buildAdminView({
    env: process.env,
    authorizationHeader: null,
    adminCookie: jar.get(ADMIN_COOKIE)?.value ?? null,
    store: tokenStoreForEnv(),
    now: () => Date.now(),
    loadBots: loadBots,
  });

  if (view.kind === "unavailable") {
    if (process.env.VERCEL_ENV === "production") {
      return (
        <main className="panel">
          <h1>Admin is unavailable</h1>
          <p className="meta">
            The admin secret is missing, or the Hearthline workspace has no admin role. Nothing is listed until both are present.
          </p>
        </main>
      );
    }
    return <DemoAdmin />;
  }

  if (view.kind === "sign-in") {
    return (
      <main className="panel mx-auto max-w-md p-4">
        <h1 className="text-2xl">Admin sign-in</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Enter the server admin secret. It is not stored in the page.</p>
        {params.error === "admin_forbidden" ? (
          <p className="mt-3 text-sm text-[var(--red)]">That secret was not accepted.</p>
        ) : null}
        <form className="mt-4 grid gap-3" action="/api/admin/session" method="post">
          <label className="field">
            <span>Admin secret</span>
            <input name="secret" type="password" autoComplete="current-password" required />
          </label>
          <button className="btn" type="submit">
            Continue
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl">Hearthline Instruments</h1>
        <form action="/api/admin/session" method="post">
          <input type="hidden" name="intent" value="signout" />
          <button className="btn secondary" type="submit">
            Sign out
          </button>
        </form>
      </div>
      <Section title="Workspaces">
        <WorkspaceList rows={view.workspaces} />
      </Section>
      <Section title="Subscribers">
        <SubscriberList rows={view.subscribers} />
      </Section>
      <Section title="Subscription">
        <SubscriptionList row={view.subscription} />
      </Section>
      <Section title="Settings">
        <SettingsList />
      </Section>
      <Section title="Meeting bots">
        <BotList rows={view.bots} />
      </Section>
      <Section title="API and MCP tokens">
        <TokenList rows={view.tokens} />
      </Section>
    </main>
  );
}

async function loadBots(): Promise<AdminBotRow[]> {
  try {
    if (dataMode() === "supabase") {
      const client = createServiceClient();
      const { data, error } = await client.from("bots").select("id, meeting_id, recall_bot_id, status, join_at");
      if (error) throw new Error("bots_unavailable");
      const meetings = await client.from("meetings").select("id, title");
      const titles = new Map((meetings.data ?? []).map((row) => [String(row.id), String(row.title)]));
      return mergeBots(
        (data ?? []).map((row) => ({
          id: String(row.id),
          meetingId: String(row.meeting_id),
          meetingTitle: titles.get(String(row.meeting_id)) ?? String(row.meeting_id),
          recallBotId: String(row.recall_bot_id),
          status: String(row.status),
          joinAt: row.join_at ? String(row.join_at) : null,
        })),
      );
    }
    const snapshot = await recallStoreForEnv(process.env).snapshot();
    const titles = new Map(snapshot.meetings.map((meeting) => [meeting.id, meeting.title]));
    return mergeBots(
      snapshot.bots.map((bot) => ({
        id: bot.id,
        meetingId: bot.meetingId,
        meetingTitle: titles.get(bot.meetingId) ?? bot.meetingId,
        recallBotId: bot.recallBotId,
        status: bot.status,
        joinAt: bot.joinAt,
      })),
    );
  } catch {
    return SEEDED_ADMIN_BOTS;
  }
}

function mergeBots(live: AdminBotRow[]): AdminBotRow[] {
  const byId = new Map(SEEDED_ADMIN_BOTS.map((bot) => [bot.id, bot]));
  for (const bot of live) byId.set(bot.id, bot);
  return [...byId.values()];
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel p-4">
      <h2 className="mb-3 text-xl">{title}</h2>
      {children}
    </section>
  );
}

function WorkspaceList({ rows }: { rows: WorkspaceRecord[] }) {
  return (
    <ul className="grid gap-2 text-sm">
      {rows.map((row) => (
        <li key={row.id} className="break-all">
          <span className="font-medium">{row.name}</span>
          <span className="text-[var(--muted)]"> · {row.slug} · {row.id}</span>
        </li>
      ))}
    </ul>
  );
}

function SubscriberList({ rows }: { rows: SubscriberRecord[] }) {
  return (
    <>
      <ul className="grid gap-3 text-sm md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="border-t border-[var(--line)] pt-2 first:border-t-0 first:pt-0">
            <div className="font-medium">{row.displayName}</div>
            <div className="break-all text-[var(--muted)]">{row.email}</div>
            <div>{row.role}</div>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="text-[var(--muted)]">
              <th className="py-1 pr-3 font-medium">Name</th>
              <th className="py-1 pr-3 font-medium">Email</th>
              <th className="py-1 pr-3 font-medium">Role</th>
              <th className="py-1 font-medium">Id</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-[var(--line)]">
                <td className="py-2 pr-3">{row.displayName}</td>
                <td className="py-2 pr-3">{row.email}</td>
                <td className="py-2 pr-3">{row.role}</td>
                <td className="py-2 break-all">{row.id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SubscriptionList({ row }: { row: SubscriptionRow }) {
  return (
    <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
      <div>
        <dt className="text-[var(--muted)]">Workspace</dt>
        <dd>{row.workspace}</dd>
      </div>
      <div>
        <dt className="text-[var(--muted)]">Active</dt>
        <dd>{row.active ? "yes" : "no"}</dd>
      </div>
      <div>
        <dt className="text-[var(--muted)]">Stripe</dt>
        <dd>{row.stripeConnected ? "connected" : "not connected"}</dd>
      </div>
      <div className="sm:col-span-2">
        <dt className="text-[var(--muted)]">Note</dt>
        <dd>{row.note}</dd>
      </div>
    </dl>
  );
}

function BotList({ rows }: { rows: AdminBotRow[] }) {
  return (
    <>
      <ul className="grid gap-3 text-sm md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="border-t border-[var(--line)] pt-2 first:border-t-0 first:pt-0">
            <div className="font-medium">{row.meetingTitle}</div>
            <div>Status {row.status}</div>
            <div className="break-all text-[var(--muted)]">{row.recallBotId}</div>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="text-[var(--muted)]">
              <th className="py-1 pr-3 font-medium">Meeting</th>
              <th className="py-1 pr-3 font-medium">Status</th>
              <th className="py-1 pr-3 font-medium">Recall id</th>
              <th className="py-1 font-medium">Join at</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-[var(--line)]">
                <td className="py-2 pr-3">{row.meetingTitle}</td>
                <td className="py-2 pr-3">{row.status}</td>
                <td className="py-2 pr-3 break-all">{row.recallBotId}</td>
                <td className="py-2">{row.joinAt ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function TokenList({ rows }: { rows: TokenMetadata[] }) {
  return (
    <>
      <ul className="grid gap-3 text-sm md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="border-t border-[var(--line)] pt-2 first:border-t-0 first:pt-0">
            <TokenFacts row={row} />
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="text-[var(--muted)]">
              <th className="py-1 pr-3 font-medium">Token</th>
              <th className="py-1 pr-3 font-medium">Scopes</th>
              <th className="py-1 pr-3 font-medium">Created</th>
              <th className="py-1 pr-3 font-medium">Last used</th>
              <th className="py-1 pr-3 font-medium">Expires</th>
              <th className="py-1 font-medium">State</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-[var(--line)] align-top">
                <td className="py-2 pr-3">
                  {row.prefix}…{row.last4}
                  <div className="text-[var(--muted)]">{row.label}</div>
                </td>
                <td className="py-2 pr-3">{row.scopes.join(", ")}</td>
                <td className="py-2 pr-3">{shortDate(row.createdAt)}</td>
                <td className="py-2 pr-3">{row.lastUsedAt ? shortDate(row.lastUsedAt) : "—"}</td>
                <td className="py-2 pr-3">{row.expiresAt ? shortDate(row.expiresAt) : "—"}</td>
                <td className="py-2">
                  {row.revokedAt ? (
                    "revoked"
                  ) : (
                    <form action="/api/admin/tokens/revoke" method="post">
                      <input type="hidden" name="id" value={row.id} />
                      <button className="btn danger" type="submit">
                        Revoke
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function TokenFacts({ row }: { row: TokenMetadata }) {
  return (
    <div className="grid gap-1">
      <div className="font-medium">
        {row.prefix}…{row.last4}
      </div>
      <div>{row.label}</div>
      <div className="break-words">{row.scopes.join(", ")}</div>
      <div className="text-[var(--muted)]">
        Created {shortDate(row.createdAt)} · used {row.lastUsedAt ? shortDate(row.lastUsedAt) : "never"} ·{" "}
        {row.revokedAt ? "revoked" : `expires ${row.expiresAt ? shortDate(row.expiresAt) : "—"}`}
      </div>
      {row.revokedAt ? null : (
        <form action="/api/admin/tokens/revoke" method="post">
          <input type="hidden" name="id" value={row.id} />
          <button className="btn danger" type="submit">
            Revoke
          </button>
        </form>
      )}
    </div>
  );
}

function shortDate(value: string): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Date(parsed).toISOString().slice(0, 16).replace("T", " ");
}

async function DemoAdmin() {
  const people = seededSubscribers();
  const tokens = await demoTokenRows();
  return (
    <main className="page">
      <header className="page-head">
        <div>
          <h1>Admin</h1>
          <p className="lede">
            Demo fixture for Hearthline Instruments. The admin secret is unset, so this is not the live gate. Token
            hashes are not shown. Creating a live token still needs the pepper and a signed-in subscriber.
          </p>
        </div>
      </header>
      <Section title="Settings">
        <SettingsList />
      </Section>
      <Section title="Subscribers">
        <ul className="plain stack-tight">
          {people.map((person) => (
            <li key={person.id}>
              {person.displayName} · {person.email} · {person.role}
            </li>
          ))}
        </ul>
      </Section>
      <Section title="API tokens">
        <ul className="plain stack-tight">
          {tokens.map((row) => (
            <li key={row.id}>
              <span className="mono">
                {row.prefix}…{row.last4}
              </span>
              {" · "}
              {row.label}
              {" · "}
              {row.scopes.join(", ")}
              {" · "}
              {row.revokedAt ? "revoked" : "active"}
            </li>
          ))}
        </ul>
      </Section>
    </main>
  );
}

function SettingsList() {
  const settings = deskSettings();
  const rows: [string, string][] = [
    ["Data mode", settings.dataMode],
    ["Supabase", settings.supabaseConfigured ? "configured" : "not configured"],
    ["Extraction", settings.extraction],
    ["LLM_ENABLED", "off"],
    ["Recall", settings.recallConfigured ? "configured" : "mocked on the meetings page"],
    ["Subscription", settings.subscriptionActive ? "active" : "inactive"],
    ["Admin secret", settings.adminSecretConfigured ? "set" : "unset"],
    ["Token pepper", settings.tokenPepperConfigured ? "set" : "unset"],
  ];
  return (
    <dl className="fields">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

async function demoTokenRows(): Promise<TokenMetadata[]> {
  try {
    if (dataMode() === "memory") return tokenStoreForEnv().listAllMetadata();
  } catch {
    return seededTokens().map(toTokenMetadata);
  }
  return seededTokens().map(toTokenMetadata);
}
