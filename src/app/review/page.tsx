import Link from "next/link";
import { RefreshWhilePending } from "@/components/refresh";
import { executionFieldsReady, type UnitListItem } from "@/lib/domain";
import { errorText, knownApproval, knownList, knownText, statusLabel, UNIT_LABEL } from "@/lib/present";
import { getContext } from "@/lib/session";

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; state?: string }>;
}) {
  const params = await searchParams;
  const { actor, repo } = await getContext();
  if (!actor) {
    return (
      <main className="panel p-6">
        <h1 className="text-4xl">Review queue</h1>
        <p className="mt-3 text-[var(--muted)]">
          <Link href="/login">Sign in</Link> to see proposed units.
        </p>
      </main>
    );
  }

  const state = params.state === "rejected" ? "rejected" : "proposed";
  const [units, jobs] = await Promise.all([repo.listUnits(actor, state), repo.listJobs(actor)]);
  const pending = jobs.some((job) => job.status === "received" || job.status === "stored" || job.status === "extracting");
  const notice = errorText(params.error);

  return (
    <main className="grid gap-5">
      <RefreshWhilePending pending={pending} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl">Review queue</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Proposed units stay untrusted until you accept or reject them.
          </p>
        </div>
        <Link className="text-sm underline" href={state === "proposed" ? "/review?state=rejected" : "/review"}>
          {state === "proposed" ? "Show rejected" : "Show proposed"}
        </Link>
      </div>
      {notice ? <p className="panel px-4 py-3 text-sm text-[var(--red)]">{notice}</p> : null}
      <section className="panel p-4">
        <h2 className="text-2xl">Jobs</h2>
        {jobs.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">No jobs yet.</p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {jobs.slice(0, 8).map((job) => (
              <li key={job.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>{job.transcriptTitle || "Untitled transcript"}</span>
                <span className="chip" data-status={job.status}>
                  {statusLabel(job.status)}
                  {job.failureReason ? ` · ${job.failureReason}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {units.length === 0 ? (
        <section className="panel p-6">
          <h2 className="text-2xl">No {state} units</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            <Link href="/ingest">Submit a transcript</Link> to start a review.
          </p>
        </section>
      ) : (
        units.map((unit) => <UnitCard key={unit.id} unit={unit} state={state} />)
      )}
    </main>
  );
}

function UnitCard({ unit, state }: { unit: UnitListItem; state: "proposed" | "rejected" }) {
  const ready = executionFieldsReady(unit);
  return (
    <article className="panel p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="chip" data-status={unit.reviewState}>
          {UNIT_LABEL[unit.unitType]}
        </span>
        {unit.unitType === "design_decision" || unit.unitType === "pending_task" ? (
          <span className="text-sm text-[var(--muted)]">
            {ready ? "Execution fields are present" : "Missing execution fields"}
          </span>
        ) : null}
      </div>
      <h2 className="mt-3 text-3xl">{unit.title}</h2>
      <p className="mt-2 max-w-3xl">{unit.body}</p>
      {unit.transcriptTitle ? (
        <p className="mt-2 text-sm text-[var(--muted)]">From {unit.transcriptTitle}</p>
      ) : null}
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Owner" value={knownText(unit.ownerPresence, unit.ownerName)} unknown={unit.ownerPresence === "unknown"} />
        <Field label="Dependencies" value={knownList(unit.dependenciesPresence, unit.dependencies)} unknown={unit.dependenciesPresence === "unknown"} />
        <Field label="Systems" value={knownList(unit.systemsPresence, unit.systemsTouched)} unknown={unit.systemsPresence === "unknown"} />
        <Field label="Acceptance" value={knownText(unit.acceptancePresence, unit.acceptanceCriteria)} unknown={unit.acceptancePresence === "unknown"} />
        <Field label="Due" value={knownText(unit.duePresence, unit.dueDate)} unknown={unit.duePresence === "unknown"} />
        <Field label="Approval" value={knownApproval(unit.approvalPresence, unit.approvalRequired)} unknown={unit.approvalPresence === "unknown"} />
      </dl>
      {unit.sourceExcerpt ? (
        <blockquote className="mt-4 border-l-2 border-[var(--line)] pl-3 text-sm text-[var(--muted)]">
          {unit.sourceExcerpt}
        </blockquote>
      ) : null}
      {state === "proposed" ? (
        <div className="mt-4 flex gap-2">
          <form action="/api/review" method="post">
            <input type="hidden" name="unitId" value={unit.id} />
            <input type="hidden" name="action" value="accept" />
            <button className="btn" type="submit">
              Accept
            </button>
          </form>
          <form action="/api/review" method="post">
            <input type="hidden" name="unitId" value={unit.id} />
            <input type="hidden" name="action" value="reject" />
            <button className="btn danger" type="submit">
              Reject
            </button>
          </form>
        </div>
      ) : null}
    </article>
  );
}

function Field({ label, value, unknown }: { label: string; value: string; unknown: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">{label}</dt>
      <dd className={unknown ? "unknown" : ""}>{value}</dd>
    </div>
  );
}
