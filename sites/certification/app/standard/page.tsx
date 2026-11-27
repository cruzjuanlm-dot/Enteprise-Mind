import type { Metadata } from "next";
import { MarkdownBlock } from "@/components/markdown-block";
import { PageHeader } from "@/components/page-header";
import { StatusLabel } from "@/components/status-label";
import { commentIssueUrl, site } from "@/lib/site";
import { loadStandard, standardIssues } from "@/lib/standard";

export const metadata: Metadata = {
  title: "The standard",
};

export default function StandardPage() {
  const sections = loadStandard();
  const issues = standardIssues(sections);
  if (issues.length > 0) {
    throw new Error(issues.join("\n"));
  }
  return (
    <>
      <PageHeader
        kicker={`Flux Standard v${site.version}`}
        title="The standard"
        lede="Draft for public comment. There is no Candidate and no Final. An examination does not use this wording yet."
      />
      <section aria-labelledby="labels-title">
        <h2 id="labels-title">Status labels</h2>
        <ol className="legend">
          <li>
            <StatusLabel tone="info">Draft</StatusLabel>
            <span>Open for comment. Wording may change.</span>
            <span className="kicker">This version</span>
          </li>
          <li>
            <StatusLabel tone="neutral">Candidate</StatusLabel>
            <span>Wording frozen for a recorded comment period.</span>
            <span className="kicker">Not used yet</span>
          </li>
          <li>
            <StatusLabel tone="final">Final</StatusLabel>
            <span>Examinations use this wording.</span>
            <span className="kicker">Not used yet</span>
          </li>
        </ol>
      </section>
      <nav aria-label="Contents">
        <ol className="toc">
          {sections.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`}>{section.title}</a>
            </li>
          ))}
        </ol>
      </nav>
      <div className="standard-layout">
        <article className="stack">
          {sections.map((section) => (
            <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`}>
              <h2 id={`${section.id}-title`}>{section.title}</h2>
              <MarkdownBlock source={section.body} />
            </section>
          ))}
        </article>
        <aside className="panel comment-window" aria-labelledby="comment-title">
          <h2 id="comment-title">Public comment</h2>
          <p>
            v{site.version} is {site.status}. Name the section you are commenting on.
          </p>
          <dl className="meta-grid">
            <dt>Version</dt>
            <dd>{site.version}</dd>
            <dt>Status</dt>
            <dd>{site.status}</dd>
            <dt>History</dt>
            <dd>
              <a href="#history">Version history</a>
            </dd>
          </dl>
          <a className="button" href={commentIssueUrl()} target="_blank" rel="noreferrer">
            Open a GitHub issue
          </a>
          <p className="note">Opens the issue tracker in a new tab. This site does not store the comment.</p>
        </aside>
      </div>
    </>
  );
}
