import Link from "next/link";
import { notFound } from "next/navigation";
import { PendingForm } from "@/components/pending-form";
import { RichText } from "@/components/rich-text";
import { provenanceFor, unitById, visibleUnits, type VisibleUnit } from "@/lib/desk/read";
import { deskNotice } from "@/lib/desk/settings";
import { deskSnapshot } from "@/lib/desk/store";
import { DOMAINS, TYPE_LABEL } from "@/lib/frontmatter";
import { loadSeedEntities, loadSeedRelationships } from "@/lib/ontology";

export const dynamic = "force-dynamic";

export default async function UnitRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ result?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const units = visibleUnits(process.cwd(), deskSnapshot());
  const unit = unitById(units, id);
  if (!unit) notFound();
  const names = new Map(loadSeedEntities().map((entity) => [entity.id, entity.name]));
  const links = loadSeedRelationships().filter((relationship) => unit.entities.includes(relationship.from) || unit.entities.includes(relationship.to));
  const related = units.filter((item) => item.id !== unit.id && item.entities.some((entityId) => unit.entities.includes(entityId)));
  const provenance = provenanceFor(unit, units);
  const notice = deskNotice(query.result) ?? deskNotice(query.error);

  return (
    <main className="page">
      <header className="page-head">
        <div>
          <p className="crumb">
            <Link href="/">Knowledge</Link>
            {" · "}
            <Link href={`/work/${unit.project.replace(/^project\./, "")}`}>{names.get(unit.project) ?? unit.project}</Link>
          </p>
          <h1>{unit.title}</h1>
          <p className="meta">
            {TYPE_LABEL[unit.type]} · {unit.scope}
            {unit.domain ? ` · ${unit.domain}` : ""} · Version {unit.version} · {unit.origin === "session" ? "This session" : "Git"}
          </p>
        </div>
      </header>
      {notice ? (
        <p className="notice" data-tone={notice.tone === "info" ? undefined : notice.tone} role="status">
          {notice.text}
        </p>
      ) : null}
      <div className="detail">
        <article className="panel stack">
          <RichText markdown={unit.body} />
          {unit.scope === "company" ? (
            <p className="meta">Company scope is the tag on this unit. The path stays {unit.path}.</p>
          ) : (
            <PromoteForm id={unit.id} />
          )}
          {unit.origin === "session" ? <ReviseForm unit={unit} /> : null}
        </article>
        <aside className="rail stack" aria-label="Provenance and links">
          <div>
            <h2 className="label flat">Provenance</h2>
            <dl className="fields">
              <div>
                <dt>Path</dt>
                <dd className="mono">{unit.path}</dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd className="mono">{unit.sourceId}</dd>
              </div>
              <div>
                <dt>Owner</dt>
                <dd>{names.get(unit.owner) ?? unit.owner}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{unit.status}</dd>
              </div>
              {unit.acceptanceCriteria ? (
                <div>
                  <dt>Acceptance</dt>
                  <dd>{unit.acceptanceCriteria}</dd>
                </div>
              ) : null}
              {unit.systemsTouched.length > 0 ? (
                <div>
                  <dt>Systems touched</dt>
                  <dd>{unit.systemsTouched.join(", ")}</dd>
                </div>
              ) : null}
            </dl>
            {unit.excerpt ? <blockquote className="quote">{unit.excerpt}</blockquote> : null}
            {unit.origin === "session" ? (
              <p className="meta follow">Held in the demo session. The markdown file is not written to git.</p>
            ) : (
              <p className="meta follow">Git history of this file is the version log. The version number is the label in the file.</p>
            )}
          </div>
          <div>
            <h2 className="label flat">Supersedes</h2>
            {provenance.supersedes.length === 0 ? <p className="meta">This unit does not supersede another.</p> : <Chain units={provenance.supersedes} />}
            {provenance.supersededBy.length > 0 ? (
              <>
                <h2 className="label">Superseded by</h2>
                <Chain units={provenance.supersededBy} />
              </>
            ) : null}
          </div>
          <div>
            <h2 className="label flat">Entities</h2>
            <ul className="plain stack-tight">
              {unit.entities.map((entityId) => (
                <li key={entityId}>
                  <Link href={`/entities#${entityId}`}>{names.get(entityId) ?? entityId}</Link>
                  <span className="meta"> {entityId}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="label flat">Relationships</h2>
            {links.length === 0 ? (
              <p className="meta">No seed relationship touches these entities.</p>
            ) : (
              <ul className="plain stack-tight">
                {links.map((relationship) => (
                  <li key={relationship.id}>
                    <span className="meta">{relationship.type}</span>
                    {" · "}
                    <Link href={`/entities#${relationship.from}`}>{names.get(relationship.from) ?? relationship.from}</Link>
                    {" → "}
                    <Link href={`/entities#${relationship.to}`}>{names.get(relationship.to) ?? relationship.to}</Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {related.length > 0 ? (
            <div>
              <h2 className="label flat">Units on the same entities</h2>
              <ul className="plain stack-tight">
                {related.map((item) => (
                  <li key={item.id}>
                    <Link href={`/units/${item.id}`}>{item.title}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
    </main>
  );
}

function Chain({ units }: { units: VisibleUnit[] }) {
  return (
    <ul className="plain stack-tight">
      {units.map((unit) => (
        <li key={unit.id}>
          <Link href={`/units/${unit.id}`}>{unit.title}</Link>
          <span className="meta"> {unit.id}</span>
        </li>
      ))}
    </ul>
  );
}

function PromoteForm({ id }: { id: string }) {
  return (
    <PendingForm action="/api/desk/promote" className="stack-tight">
      <input type="hidden" name="unitId" value={id} />
      <label className="field">
        <span className="label">Promote to company scope</span>
        <select name="domain" required defaultValue="govern">
          {DOMAINS.map((domain) => (
            <option key={domain} value={domain}>
              {domain}
            </option>
          ))}
        </select>
        <span className="help">Sets scope: company and domain. The path does not change.</span>
      </label>
      <button className="btn secondary" type="submit">
        Promote
      </button>
    </PendingForm>
  );
}

function ReviseForm({ unit }: { unit: VisibleUnit }) {
  return (
    <PendingForm action="/api/desk/revise" className="stack-tight">
      <input type="hidden" name="unitId" value={unit.id} />
      <label className="field">
        <span className="label">Edit title</span>
        <input name="title" defaultValue={unit.title} />
      </label>
      <label className="field">
        <span className="label">Edit body</span>
        <textarea name="body" rows={8} defaultValue={unit.body} />
      </label>
      <button className="btn secondary" type="submit">
        Save session edit
      </button>
    </PendingForm>
  );
}
