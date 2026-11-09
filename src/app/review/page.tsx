import Link from "next/link";
import { RefreshWhilePending } from "@/components/refresh";
import { PendingForm } from "@/components/pending-form";
import { UnitPanel } from "@/components/unit-panel";
import { canIngest, canReviewUnit } from "@/lib/authz";
import { errorText, UNIT_LABEL } from "@/lib/present";
import { getContext } from "@/lib/session";

export const metadata = { title: "Review queue · Enterprise Mind" };

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; state?: string; unit?: string; result?: string }>;
}) {
  const params = await searchParams;
  const { actor, repo } = await getContext();
  if (!actor) {
    return (
      <main className="page">
        <h1>Review queue</h1>
        <p className="lede">
          <Link href="/login">Sign in</Link> to see proposed units.
        </p>
      </main>
    );
  }

  const state = params.state === "rejected" ? "rejected" : "proposed";
  const [units, jobs, projects] = await Promise.all([
    repo.listUnits(actor, state),
    repo.listJobs(actor),
    repo.listProjects(actor),
  ]);
  const tenant = await repo.getTenant(actor.memberships[0]?.tenantId ?? "");
  const pending = jobs.some((job) => job.status === "received" || job.status === "stored" || job.status === "extracting");
  const notice = errorText(params.error);
  const result =
    params.result === "accepted"
      ? "Accepted. If the unit was filed on a project, members of that project can now read it. The task was not executed."
      : params.result === "rejected"
        ? "Rejected. The unit stays out of shared context."
        : null;
  const selected = units.find((unit) => unit.id === params.unit) ?? units[0] ?? null;
  const canSubmit = actor.memberships.some((membership) => canIngest(actor, membership.tenantId));
  const projectName = (projectId: string | null) => projects.find((project) => project.id === projectId)?.name ?? null;

  return (
    <main className="page">
      <RefreshWhilePending pending={pending} />
      <header className="page-head">
        <div>
          <h1>Review queue</h1>
          <p className="lede">
            Proposed units stay out of shared context until you accept or reject them. Job status stays on{" "}
            <Link href="/jobs">Jobs</Link>. Ready for review is not the same as accepted.
          </p>
        </div>
        <nav className="filters" aria-label="Review state">
          <Link href="/review" aria-current={state === "proposed" ? "page" : undefined}>
            Proposed
          </Link>
          <Link href="/review?state=rejected" aria-current={state === "rejected" ? "page" : undefined}>
            Rejected
          </Link>
        </nav>
      </header>

      {notice ? (
        <p className="notice" data-tone="danger" role="alert">
          {notice}
        </p>
      ) : null}
      {result ? (
        <p className="notice" data-tone={params.result === "rejected" ? "danger" : "success"} role="status">
          {result}
        </p>
      ) : null}
      {pending ? (
        <p className="notice" data-tone="warning" role="status">
          Extraction is still running. This page checks again until the job is ready for review.
        </p>
      ) : null}

      <p className="meta">
        {units.length} {state} {units.length === 1 ? "unit" : "units"}
        {tenant ? ` in ${tenant.name}` : ""}. Order: as extracted.
      </p>

      {units.length === 0 ? (
        <section className="panel stack-tight">
          <h2>{pending ? "Extraction is running" : `No ${state} units`}</h2>
          {pending ? (
            <p>Proposals appear here when extraction finishes. Nothing is shared until you review it.</p>
          ) : canSubmit ? (
            <p>
              {state === "proposed" ? (
                <>
                  <Link href="/ingest">Submit the fixture transcript</Link> to create proposals. The reader leaves
                  unstated owners, systems, and dates unknown.
                </>
              ) : (
                "Rejected proposals stay out of shared context. None are stored for this account."
              )}
            </p>
          ) : (
            <p>This role does not receive proposed units. Open a project to read accepted context.</p>
          )}
        </section>
      ) : (
        <>
          <ol className="queue">
            {units.map((unit) => (
              <li key={unit.id}>
                <Link
                  href={state === "rejected" ? `/review?state=rejected&unit=${unit.id}` : `/review?unit=${unit.id}`}
                  aria-current={selected?.id === unit.id ? "true" : undefined}
                >
                  <span className="queue-title">{unit.title}</span>
                  <span className="meta">
                    {UNIT_LABEL[unit.unitType]} · {projectName(unit.projectId) ?? "Unassigned"} ·{" "}
                    {state === "rejected" ? "Rejected" : "Proposed"}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
          {selected ? (
            <UnitPanel
              unit={selected}
              projectName={projectName(selected.projectId)}
              actions={
                state === "proposed" && canReviewUnit(actor, selected) ? (
                  <div className="stack-tight">
                    <p className="help">
                      {selected.projectId
                        ? `Accept publishes this unit to ${projectName(selected.projectId) ?? "its project"} for project members. Reject keeps it out. Neither action runs the task.`
                        : "This unit is unassigned. Accept will not place it on a project page. Reject keeps it out. Neither action runs the task."}
                    </p>
                    <div className="cluster">
                      <PendingForm action="/api/review">
                        <input type="hidden" name="unitId" value={selected.id} />
                        <input type="hidden" name="action" value="accept" />
                        <button className="btn" type="submit">
                          <span className="idle-label">Accept</span>
                          <span className="busy-label">Accepting</span>
                        </button>
                      </PendingForm>
                      <PendingForm action="/api/review">
                        <input type="hidden" name="unitId" value={selected.id} />
                        <input type="hidden" name="action" value="reject" />
                        <button className="btn danger" type="submit">
                          <span className="idle-label">Reject</span>
                          <span className="busy-label">Rejecting</span>
                        </button>
                      </PendingForm>
                    </div>
                  </div>
                ) : null
              }
            />
          ) : null}
        </>
      )}
    </main>
  );
}
