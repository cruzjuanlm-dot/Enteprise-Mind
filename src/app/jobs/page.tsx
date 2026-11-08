import Link from "next/link";
import { canManageJobs } from "@/lib/authz";
import { errorText, statusLabel } from "@/lib/present";
import { getContext } from "@/lib/session";

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const { actor, repo } = await getContext();
  if (!actor) {
    return (
      <main className="panel p-6">
        <h1 className="text-4xl">Jobs</h1>
        <p className="mt-3">
          <Link href="/login">Sign in</Link> to see job status.
        </p>
      </main>
    );
  }
  const jobs = await repo.listJobs(actor);
  const events = await Promise.all(jobs.map(async (job) => [job.id, await repo.listJobEvents(actor, job.id)] as const));
  const eventMap = new Map(events);
  const notice = errorText(params.error);
  const canRetry = actor.memberships.some((membership) => canManageJobs(actor, membership.tenantId));

  return (
    <main className="grid gap-4">
      <h1 className="text-4xl">Jobs</h1>
      {notice ? <p className="text-sm text-[var(--red)]">{notice}</p> : null}
      {jobs.length === 0 ? (
        <section className="panel p-5 text-sm text-[var(--muted)]">No jobs yet.</section>
      ) : (
        jobs.map((job) => (
          <article key={job.id} className="panel p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-2xl">{job.transcriptTitle || "Untitled transcript"}</h2>
              <span className="chip" data-status={job.status}>
                {statusLabel(job.status)}
              </span>
            </div>
            {job.failureReason ? <p className="mt-2 text-sm text-[var(--red)]">{job.failureReason}</p> : null}
            <ol className="mt-3 flex flex-wrap gap-2 text-sm text-[var(--muted)]">
              {(eventMap.get(job.id) ?? []).map((event) => (
                <li key={event.id} className="chip" data-status={event.status}>
                  {statusLabel(event.status)}
                </li>
              ))}
            </ol>
            {canRetry && job.status === "failed" ? (
              <form action={`/api/jobs/${job.id}/retry`} method="post" className="mt-4">
                <button className="btn secondary" type="submit">
                  Retry extraction
                </button>
              </form>
            ) : null}
          </article>
        ))
      )}
    </main>
  );
}
