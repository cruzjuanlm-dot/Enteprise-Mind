import Link from "next/link";
import { RefreshWhilePending } from "@/components/refresh";
import { UnitPanel } from "@/components/unit-panel";
import { canIngest } from "@/lib/authz";
import { extractDeterministic } from "@/lib/extract";
import { FIXTURES } from "@/lib/fixtures";
import { UNIT_LABEL } from "@/lib/present";
import { SAMPLE_TRANSCRIPT } from "@/lib/sample";
import { getContext } from "@/lib/session";

export default async function HomePage() {
  const { actor, mode, repo } = await getContext();
  const fixtureProject = await repo.getProject(FIXTURES.rolloutProject);
  const fixtureDepartment = fixtureProject ? await repo.getDepartment(fixtureProject.departmentId) : null;
  const fixtureTenant = fixtureProject ? await repo.getTenant(fixtureProject.tenantId) : null;
  const drafts = extractDeterministic(SAMPLE_TRANSCRIPT);
  const [lead, ...rest] = drafts;
  const scope = [fixtureTenant?.name, fixtureDepartment?.name, fixtureProject?.name].filter(Boolean).join(" / ");

  if (!actor) {
    return (
      <main className="page">
        <header className="page-head">
          <div>
            <h1>Review proposed knowledge</h1>
            <p className="lede">
              Submit a transcript, compare each proposal with its quoted passage, then accept or reject it. Accepted
              units become the shared context other people and systems can read. Rejected units stay out. This demo
              reads labeled text on the server and does not call a model.
            </p>
          </div>
          <Link className="btn" href="/login">
            Sign in with a demo fixture
          </Link>
        </header>
        <FixturePreview scope={scope} projectName={fixtureProject?.name ?? null} lead={lead} rest={rest} />
      </main>
    );
  }

  const membership = actor.memberships[0];
  const tenant = membership ? await repo.getTenant(membership.tenantId) : null;
  const projects = await repo.listProjects(actor);
  const [proposed, jobs] = await Promise.all([repo.listUnits(actor, "proposed"), repo.listJobs(actor)]);
  const acceptedGroups = await Promise.all(
    projects.map(async (project) => ({ project, units: await repo.listProjectUnits(actor, project.id) })),
  );
  const pending = jobs.some((job) => job.status === "received" || job.status === "stored" || job.status === "extracting");
  const canSubmit = actor.memberships.some((item) => canIngest(actor, item.tenantId));
  const accepted = acceptedGroups.flatMap((group) => group.units.map((unit) => ({ ...unit, project: group.project })));
  const storage =
    mode === "memory" ? "Local demo process, not Supabase." : `Stored for ${tenant?.name ?? "this company"}.`;

  return (
    <main className="page">
      <RefreshWhilePending pending={pending} />
      <header className="page-head">
        <div>
          <h1>Review proposed knowledge</h1>
          <p className="lede">
            {tenant?.name ?? "This company"} keeps proposed units out of shared context until a reviewer accepts or
            rejects them. Accepted units are what members, and other systems reading this project, can use.
          </p>
        </div>
        {proposed.length > 0 ? (
          <Link className="btn" href="/review">
            Open the review queue
          </Link>
        ) : canSubmit ? (
          <Link className="btn" href="/ingest">
            Submit the fixture transcript
          </Link>
        ) : null}
      </header>

      {pending ? (
        <p className="notice" role="status">
          Extraction is still running. Proposals show up in the review queue when the job is ready.{" "}
          <Link href="/jobs">View jobs</Link>
        </p>
      ) : null}

      {proposed.length > 0 ? (
        <section className="stack" aria-labelledby="proposed-heading">
          <div className="section-head">
            <div>
              <h2 id="proposed-heading">Waiting for review</h2>
              <p className="meta">
                {proposed.length} proposed {proposed.length === 1 ? "unit" : "units"} in {tenant?.name ?? "this company"}.{" "}
                {storage} Order: as extracted.
              </p>
            </div>
          </div>
          <ol className="queue">
            {proposed.map((unit) => {
              const project = projects.find((item) => item.id === unit.projectId);
              return (
                <li key={unit.id}>
                  <Link href={`/review?unit=${unit.id}`}>
                    <span className="queue-title">{unit.title}</span>
                    <span className="meta">
                      {UNIT_LABEL[unit.unitType]} · {project?.name ?? "Unassigned"} · Proposed
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      {accepted.length > 0 ? (
        <section className="stack" aria-labelledby="context-heading">
          <div>
            <h2 id="context-heading">Shared context</h2>
            <p className="meta">Accepted units only. {storage}</p>
          </div>
          <ol className="queue">
            {accepted.map((unit) => (
              <li key={unit.id}>
                <Link href={`/projects/${unit.project.id}`}>
                  <span className="queue-title">{unit.title}</span>
                  <span className="meta">
                    {UNIT_LABEL[unit.unitType]} · {unit.project.name} · Accepted
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {proposed.length === 0 && accepted.length === 0 && !pending ? (
        canSubmit ? (
          <FixturePreview
            scope={scope}
            projectName={fixtureProject?.name ?? null}
            lead={lead}
            rest={rest}
            note={
              tenant && fixtureTenant && tenant.id !== fixtureTenant.id
                ? `The fixture text is about ${fixtureTenant.name}. Submitting it stores the transcript on the project you select in ${tenant.name}.`
                : `Submitting the fixture files it on the project you select. The form starts on ${fixtureProject?.name ?? "the first visible project"}.`
            }
          />
        ) : (
          <section className="panel stack-tight">
            <h2>No accepted units</h2>
            <p>
              This role reads shared context. It cannot submit transcripts or accept proposals. Projects with accepted
              units will be listed here.
            </p>
          </section>
        )
      ) : canSubmit && (proposed.length > 0 || accepted.length > 0) ? (
        <p className="meta">
          The synthetic transcript is still available on <Link href="/ingest">Submit transcript</Link>. It is not a
          stored record until you submit it.
        </p>
      ) : null}
    </main>
  );
}

function FixturePreview({
  scope,
  projectName,
  lead,
  rest,
  note,
}: {
  scope: string;
  projectName: string | null;
  lead: ReturnType<typeof extractDeterministic>[number] | undefined;
  rest: ReturnType<typeof extractDeterministic>;
  note?: string;
}) {
  if (!lead) return null;
  return (
    <section className="stack" aria-labelledby="fixture-heading">
      <div>
        <h2 id="fixture-heading">Fixture preview</h2>
        <p className="meta">
          Not stored. {scope ? `${scope}. ` : ""}
          The deterministic reader produced this from the synthetic transcript. No model was called.
        </p>
        {note ? <p className="help follow">{note}</p> : null}
      </div>
      <UnitPanel unit={lead} projectName={projectName} preview />
      {rest.length > 0 ? (
        <div className="panel stack-tight">
          <h3 className="label flat">Also in this transcript</h3>
          <ul className="plain stack-tight">
            {rest.map((unit) => (
              <li key={unit.title} className="cluster">
                <span className="status" data-tone="neutral">
                  {UNIT_LABEL[unit.unitType]}
                </span>
                <span>{unit.title}</span>
                <span className="meta">{unit.ownerPresence === "unknown" ? "Owner unknown" : `Owner ${unit.ownerName}`}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
