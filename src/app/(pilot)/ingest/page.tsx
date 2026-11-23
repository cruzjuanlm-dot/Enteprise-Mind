import Link from "next/link";
import { PendingForm } from "@/components/pending-form";
import { canIngest } from "@/lib/authz";
import { errorText } from "@/lib/present";
import { SAMPLE_TITLE, SAMPLE_TRANSCRIPT } from "@/lib/sample";
import { getContext } from "@/lib/session";

export const metadata = { title: "Submit transcript · Enterprise Mind" };

export default async function IngestPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const { actor, repo, mode } = await getContext();
  if (!actor) {
    return (
      <main className="page">
        <h1>Submit a transcript</h1>
        <p className="lede">
          <Link href="/login">Sign in</Link> to store a transcript and extract proposals.
        </p>
      </main>
    );
  }

  const allowed = actor.memberships.some((membership) => canIngest(actor, membership.tenantId));
  const [projects, departments] = allowed
    ? await Promise.all([repo.listProjects(actor), repo.listDepartments(actor)])
    : [[], []];
  const notice = errorText(params.error);
  const modelConfigured = Boolean(process.env.EXTRACTION_MODEL_API_KEY?.trim());

  return (
    <main className="page">
      <header className="page-head">
        <div>
          <h1>Submit a transcript</h1>
          <p className="lede">
            This form posts to the ingest API. The original text is stored, then a job extracts proposals.{" "}
            {modelConfigured
              ? "A model key is set on the server, so extraction will call that model."
              : "No model key is set, so extraction uses the deterministic reader. Unstated fields stay unknown."}{" "}
            {mode === "memory" ? "This session stores records in the local demo process." : "Records are stored for this company."}
          </p>
        </div>
      </header>
      {notice ? (
        <p className="notice" data-tone="danger" role="alert">
          {notice}
        </p>
      ) : null}
      {allowed ? (
        <div className="measure stack">
          <section className="panel stack-tight">
            <h2>Demo fixture</h2>
            <p>
              The fields below start with a synthetic Hearthline Instruments transcript. It is not stored until you
              submit it. Edit anything before submitting. Lines beginning with Decision, Task, Term, Owner, and the
              other labeled fields are what the reader understands.
            </p>
          </section>
          <PendingForm action="/api/ingest" className="stack">
            <label className="field">
              <span className="label">Title</span>
              <input name="title" defaultValue={SAMPLE_TITLE} autoComplete="off" />
              <span className="help">Stored with the transcript. Change it if you replace the fixture text.</span>
            </label>
            <label className="field">
              <span className="label">Project</span>
              <select name="projectId" defaultValue={projects[0]?.id ?? ""}>
                <option value="">Unassigned</option>
                {projects.map((project) => {
                  const department = departments.find((item) => item.id === project.departmentId);
                  return (
                    <option key={project.id} value={project.id}>
                      {department ? `${department.name} · ${project.name}` : project.name}
                    </option>
                  );
                })}
              </select>
              <span className="help">
                Accepted units appear on this project. Unassigned units do not show up in a project context.
              </span>
            </label>
            <label className="field">
              <span className="label">Source id</span>
              <input name="sourceExternalId" placeholder="Optional" autoComplete="off" />
              <span className="help">Optional. The same source id stores one transcript. Leave blank to store a new one.</span>
            </label>
            <label className="field">
              <span className="label">Transcript</span>
              <textarea name="content" rows={16} required defaultValue={SAMPLE_TRANSCRIPT} />
            </label>
            <button className="btn" type="submit">
              <span className="idle-label">Store and extract</span>
              <span className="busy-label">Storing transcript</span>
            </button>
          </PendingForm>
        </div>
      ) : (
        <section className="panel">
          <p>This role can read accepted units. Submitting transcripts is limited to reviewers and admins.</p>
        </section>
      )}
    </main>
  );
}
