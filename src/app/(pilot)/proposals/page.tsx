import Link from "next/link";
import { PendingForm } from "@/components/pending-form";
import { DOMAINS, TYPE_CODES, TYPE_LABEL } from "@/lib/frontmatter";
import { deskNotice } from "@/lib/desk/settings";
import { deskSnapshot } from "@/lib/desk/store";

export const dynamic = "force-dynamic";

export default async function ProposalsPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string; error?: string; id?: string; state?: string }>;
}) {
  const params = await searchParams;
  const notice = deskNotice(params.result) ?? deskNotice(params.error);
  const showRejected = params.state === "rejected";
  const proposals = deskSnapshot().proposals.filter((proposal) => proposal.status === (showRejected ? "rejected" : "proposed"));
  const selected = proposals.find((proposal) => proposal.id === params.id) ?? proposals[0] ?? null;

  return (
    <main className="page">
      <header className="page-head">
        <div>
          <h1>Proposals</h1>
          <p className="lede">
            Approve a unit to place it in the knowledge tree. Edit the title, type, body, or scope first. Reject keeps it
            out. Nothing here executes work.
          </p>
        </div>
        <nav className="filters" aria-label="Proposal state">
          <Link href="/proposals" aria-current={showRejected ? undefined : "page"}>
            Proposed
          </Link>
          <Link href="/proposals?state=rejected" aria-current={showRejected ? "page" : undefined}>
            Rejected
          </Link>
        </nav>
      </header>
      {notice ? (
        <p className="notice" data-tone={notice.tone === "info" ? undefined : notice.tone} role="status">
          {notice.text}
        </p>
      ) : null}
      {proposals.length === 0 ? (
        <section className="panel stack-tight">
          <h2>{showRejected ? "No rejected proposals" : "No proposals"}</h2>
          <p>
            <Link href="/compile">Compile the Kilnwatch sample</Link> to create proposals.
          </p>
        </section>
      ) : (
        <div className="detail">
          <div className="stack">
            <ol className="queue">
              {proposals.map((proposal) => (
                <li key={proposal.id}>
                  <Link
                    href={showRejected ? `/proposals?state=rejected&id=${proposal.id}` : `/proposals?id=${proposal.id}`}
                    aria-current={selected?.id === proposal.id ? "true" : undefined}
                  >
                    <span className="queue-title">{proposal.title}</span>
                    <span className="meta">
                      {TYPE_LABEL[proposal.type]} · {proposal.scope}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
            {selected && !showRejected ? (
              <PendingForm action="/api/desk/review" className="panel stack">
                <input type="hidden" name="proposalId" value={selected.id} />
                <label className="field">
                  <span className="label">Title</span>
                  <input name="title" defaultValue={selected.title} required />
                </label>
                <label className="field">
                  <span className="label">Type</span>
                  <select name="type" defaultValue={selected.type}>
                    {TYPE_CODES.map((type) => (
                      <option key={type} value={type}>
                        {TYPE_LABEL[type]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="label">Body</span>
                  <textarea name="body" rows={6} defaultValue={selected.body} required />
                </label>
                <label className="field">
                  <span className="label">Acceptance</span>
                  <input name="acceptance" defaultValue={selected.acceptance ?? ""} />
                  <span className="help">Required when the type is Requirement.</span>
                </label>
                <label className="field">
                  <span className="label">Scope</span>
                  <select name="scope" defaultValue={selected.scope}>
                    <option value="project">Project</option>
                    <option value="company">Company</option>
                  </select>
                </label>
                <label className="field">
                  <span className="label">Domain</span>
                  <select name="domain" defaultValue={selected.domain ?? ""}>
                    <option value="">None until promotion</option>
                    {DOMAINS.map((domain) => (
                      <option key={domain} value={domain}>
                        {domain}
                      </option>
                    ))}
                  </select>
                  <span className="help">Required when scope is company. The file stays in the project folder.</span>
                </label>
                <div className="cluster">
                  <button className="btn" name="action" value="approve" type="submit">
                    Approve
                  </button>
                  <button className="btn secondary" name="action" value="save" type="submit">
                    Save edits
                  </button>
                  <button className="btn danger" name="action" value="reject" type="submit">
                    Reject
                  </button>
                </div>
              </PendingForm>
            ) : null}
          </div>
          {selected ? (
            <aside className="rail stack-tight" aria-label="Evidence">
              <h2 className="label flat">Evidence</h2>
              <p className="meta">Labeled block only. The rest of the transcript was discarded. Confidence is not assessed.</p>
              <blockquote className="quote">{selected.excerpt}</blockquote>
              <dl className="fields">
                <div>
                  <dt>Named owner</dt>
                  <dd>{selected.ownerName ?? "Unknown"}</dd>
                </div>
                <div>
                  <dt>Systems</dt>
                  <dd>{selected.systems.length > 0 ? selected.systems.join(", ") : "Unknown"}</dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd className="mono">{selected.sourceId}</dd>
                </div>
              </dl>
            </aside>
          ) : null}
        </div>
      )}
    </main>
  );
}
