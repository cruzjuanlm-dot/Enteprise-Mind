import { redirect } from "next/navigation";
import { SupabaseLogin } from "@/components/supabase-login";
import { LOCAL_ACCOUNTS } from "@/lib/fixtures";
import { getContext } from "@/lib/session";

export default async function LoginPage() {
  const { actor, mode } = await getContext();
  if (actor) redirect("/review");

  return (
    <main className="mx-auto grid max-w-xl gap-4">
      <section className="panel p-6">
        <h1 className="text-4xl">Sign in</h1>
        {mode === "memory" ? (
          <>
            <p className="mt-3 text-sm text-[var(--muted)]">
              Local development sessions stand in for Supabase Auth only while the Supabase variables are unset.
              These fixtures are not accounts, and this form is disabled when Supabase is configured.
            </p>
            <div className="mt-5 grid gap-2">
              {LOCAL_ACCOUNTS.map((account) => (
                <form key={account.id} action="/api/auth/local" method="post">
                  <input type="hidden" name="email" value={account.email} />
                  <button className="btn secondary block w-full" type="submit">
                    Continue as {account.roleLabel}
                  </button>
                </form>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="mt-3 mb-5 text-sm text-[var(--muted)]">
              Use the Supabase Auth user that has a tenant membership.
            </p>
            <SupabaseLogin />
          </>
        )}
      </section>
    </main>
  );
}
