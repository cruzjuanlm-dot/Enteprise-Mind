import Link from "next/link";
import { canIngest } from "@/lib/authz";
import { errorText } from "@/lib/present";
import { SAMPLE_TRANSCRIPT } from "@/lib/sample";
import { getContext } from "@/lib/session";

export default async function IngestPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const { actor, repo } = await getContext();
  if (!actor) {
    return (
      <main className="panel p-6">
        <h1 className="text-4xl">Ingest</h1>
        <p className="mt-3">
          <Link href="/login">Sign in</Link> to submit a transcript.
        </p>
      </main>
    );
  }
  const allowed = actor.memberships.some((membership) => canIngest(actor, membership.tenantId));
  const projects = allowed ? await repo.listProjects(actor) : [];
  const notice = errorText(params.error);

  return (
    <main className="panel p-6">
      <h1 className="text-4xl">Ingest a transcript</h1>
      <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
        This form posts to the ingest API. The original text is stored with the transcript, then extraction runs
        as a job.
      </p>
      {notice ? <p className="mt-4 text-sm text-[var(--red)]">{notice}</p> : null}
      {allowed ? (
        <form action="/api/ingest" method="post" className="mt-5 grid gap-4">
          <label className="field">
            <span>Title</span>
            <input name="title" placeholder="Weekly design review" />
          </label>
          <label className="field">
            <span>Project</span>
            <select name="projectId" defaultValue="">
              <option value="">Unassigned</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Source id</span>
            <input name="sourceExternalId" placeholder="Optional idempotency key" />
          </label>
          <label className="field">
            <span>Transcript</span>
            <textarea name="content" rows={14} required placeholder={SAMPLE_TRANSCRIPT} />
          </label>
          <button className="btn w-fit" type="submit">
            Store and extract
          </button>
        </form>
      ) : (
        <p className="mt-4 text-sm">Your role can read accepted units. Transcript ingest is limited to reviewers and admins.</p>
      )}
    </main>
  );
}
