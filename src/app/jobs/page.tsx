import Link from "next/link";
import { PendingForm } from "@/components/pending-form";
import { canManageJobs } from "@/lib/authz";
import { errorText, formatWhen, jobTone, statusLabel } from "@/lib/present";
import { getContext } from "@/lib/session";

export const metadata = { title: "Jobs · Enterprise Mind" };

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const { actor, repo } = await getContext();
  if (!actor) {
    return (
      <main className="page">
        <h1>Jobs</h1>
        <p className="lede">
          <Link href="/login">Sign in</Link> to see extraction status.
        </p>
      </main>
    );
  }

  const jobs = await repo.listJobs(actor);
  const events = await Promise.all(jobs.map(async (job) => [job.id, await repo.listJobEvents(actor, job.id)] as const));
  const eventMap = new Map(events);
  const notice = errorText(params.error);
  const canRetry = actor.memberships.some((membership) => canManageJobs(actor, membership.tenantId));
  const tenant = await repo.getTenant(actor.memberships[0]?.tenantId ?? "");

  return (
    <main className="page">
      <header className="page-head">
        <div>
          <h1>Jobs</h1>
          <p className="lede">
            Extraction status is separate from review. Ready for review means proposals exist. It does not mean they
            were accepted.
          </p>
        </div>
      </header>
      {notice ? (
        <p className="notice" data-tone="danger" role="alert">
          {notice}
        </p>
      ) : null}
      <p className="meta">
        {jobs.length} {jobs.length === 1 ? "job" : "jobs"}
        {tenant ? ` in ${tenant.name}` : ""}. Newest first.
      </p>
      {jobs.length === 0 ? (
        <section className="panel stack-tight">
          <h2>No jobs yet</h2>
          <p>
            {canRetry ? (
              <>
                <Link href="/ingest">Submit a transcript</Link> to start extraction.
              </>
            ) : (
              "This role cannot see extraction jobs."
            )}
          </p>
        </section>
      ) : (
        <div className="stack">
          {jobs.map((job) => {
            const history = eventMap.get(job.id) ?? [];
            const failure = job.failureReason ? errorText(job.failureReason) ?? job.failureReason : null;
            return (
              <article key={job.id} className="panel stack-tight">
                <div className="cluster">
                  <h2>{job.transcriptTitle || "Untitled transcript"}</h2>
                  <span className="status" data-tone={jobTone(job.status)}>
                    {statusLabel(job.status)}
                  </span>
                </div>
                <p className="meta">
                  Updated <time dateTime={job.updatedAt}>{formatWhen(job.updatedAt)}</time>
                  {" · "}
                  <span className="mono">{job.id}</span>
                </p>
                {failure ? (
                  <p className="notice" data-tone="danger">
                    {failure}
                  </p>
                ) : null}
                {history.length > 0 ? (
                  <ol className="history">
                    {history.map((event) => (
                      <li key={event.id}>
                        <time dateTime={event.createdAt}>{formatWhen(event.createdAt)}</time> {statusLabel(event.status)}
                        {event.detail ? ` — ${errorText(event.detail) ?? event.detail}` : ""}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="meta">No status history stored.</p>
                )}
                {canRetry && job.status === "failed" ? (
                  <PendingForm action={`/api/jobs/${job.id}/retry`}>
                    <button className="btn secondary" type="submit">
                      <span className="idle-label">Retry extraction</span>
                      <span className="busy-label">Retrying</span>
                    </button>
                  </PendingForm>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
