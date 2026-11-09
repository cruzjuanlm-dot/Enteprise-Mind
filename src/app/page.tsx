import Link from "next/link";
import { getContext } from "@/lib/session";

export default async function HomePage() {
  const { actor, mode } = await getContext();
  return (
    <main className="grid gap-6">
      <section className="panel p-6">
        <p className="text-sm uppercase tracking-[0.16em] text-[var(--green)]">Capture, then review</p>
        <h1 className="mt-2 text-4xl">Conversations become decisions and tasks a person can accept.</h1>
        <p className="mt-4 max-w-2xl text-[var(--muted)]">
          This pilot slice stores a transcript, extracts proposed units, and keeps them out of the trusted
          project record until a reviewer accepts or rejects them. Nothing here executes work on its own.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {actor ? (
            <>
              <Link className="btn" href="/review">
                Open the review queue
              </Link>
              <Link className="btn secondary" href="/ingest">
                Submit a transcript
              </Link>
            </>
          ) : (
            <Link className="btn" href="/login">
              Sign in
            </Link>
          )}
        </div>
      </section>
      <section className="grid gap-3 md:grid-cols-3">
        <Step n="1" title="Ingest" body="A backend route stores the original payload and a normalized transcript." />
        <Step n="2" title="Extract" body="An async job proposes units. Missing owners, systems, and dates stay unknown." />
        <Step n="3" title="Review" body="Accept or reject each proposal. Accepted units show up on the project." />
      </section>
      {mode === "memory" ? (
        <p className="text-sm text-[var(--muted)]">
          Supabase environment variables are unset, so this process is using the local memory stand-in. Sign in
          with a local fixture to walk the review flow.
        </p>
      ) : null}
    </main>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <article className="panel p-4">
      <p className="text-sm text-[var(--green)]">{n}</p>
      <h2 className="text-2xl">{title}</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">{body}</p>
    </article>
  );
}
