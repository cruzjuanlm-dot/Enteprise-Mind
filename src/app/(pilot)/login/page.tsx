import { redirect } from "next/navigation";
import { SupabaseLogin } from "@/components/supabase-login";
import { PendingForm } from "@/components/pending-form";
import { FIXTURES, LOCAL_ACCOUNTS } from "@/lib/fixtures";
import { getContext } from "@/lib/session";

export const metadata = { title: "Sign in · Enterprise Mind" };

export default async function LoginPage() {
  const { actor, mode, repo } = await getContext();
  if (actor) redirect("/review");

  const [tenant, other, project, restricted, otherProject] = await Promise.all([
    repo.getTenant(FIXTURES.pilotTenant),
    repo.getTenant(FIXTURES.otherTenant),
    repo.getProject(FIXTURES.rolloutProject),
    repo.getProject(FIXTURES.restrictedProject),
    repo.getProject(FIXTURES.otherProject),
  ]);

  const details: Record<(typeof LOCAL_ACCOUNTS)[number]["id"], string> = {
    [FIXTURES.reviewer]: `Can submit transcripts and accept or reject proposals on ${project?.name ?? "assigned projects"}.`,
    [FIXTURES.member]: `Can read accepted units on ${project?.name ?? "assigned projects"}. Cannot review or submit transcripts.`,
    [FIXTURES.admin]: `Can see every ${tenant?.name ?? "company"} project${restricted ? `, including ${restricted.name}` : ""}.`,
    [FIXTURES.outsider]: `${other?.name ?? "Another company"}${otherProject ? `, ${otherProject.name}` : ""}. Cannot read ${tenant?.name ?? "the other company"}.`,
  };

  return (
    <main className="page measure">
      <header className="page-head">
        <div>
          <h1>Sign in</h1>
          {mode === "memory" ? (
            <p className="lede">
              Demo fixtures stand in for Supabase Auth only while Supabase is unset. They are not accounts, and this
              list is hidden when Supabase is configured.
            </p>
          ) : (
            <p className="lede">Use the Supabase Auth user that has a company membership. This is live authentication, not a demo fixture.</p>
          )}
        </div>
      </header>
      {mode === "memory" ? (
        <section className="stack" aria-labelledby="fixtures">
          <h2 id="fixtures">Demo fixtures</h2>
          <div className="stack">
            {LOCAL_ACCOUNTS.map((account, index) => (
              <div key={account.id} className="account">
                <PendingForm action="/api/auth/local">
                  <input type="hidden" name="email" value={account.email} />
                  <button className={index === 0 ? "btn block" : "btn secondary block"} type="submit">
                    <span className="idle-label">Continue as {account.roleLabel}</span>
                    <span className="busy-label">Signing in</span>
                  </button>
                </PendingForm>
                <p className="help">
                  <span className="mono">{account.email}</span>. {details[account.id]}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <SupabaseLogin />
      )}
    </main>
  );
}
