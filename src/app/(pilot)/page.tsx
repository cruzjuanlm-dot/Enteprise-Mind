import Link from "next/link";
import { CORE_AREAS, projectsIn, visibleUnits, type VisibleUnit } from "@/lib/desk/read";
import { deskSnapshot } from "@/lib/desk/store";
import { DOMAINS, TYPE_LABEL, type UnitDomain } from "@/lib/frontmatter";
import { listComps } from "@/lib/catalog";
import { loadSeedEntities } from "@/lib/ontology";

export const dynamic = "force-dynamic";

export default function KnowledgePage() {
  const state = deskSnapshot();
  const units = visibleUnits(process.cwd(), state);
  const names = new Map(loadSeedEntities().map((entity) => [entity.id, entity.name]));
  const projects = projectsIn(units, names);
  const company = units.filter((unit) => unit.scope === "company");
  const proposed = state.proposals.filter((proposal) => proposal.status === "proposed").length;
  const comps = listComps();

  return (
    <main className="page">
      <header className="page-head">
        <div>
          <h1>Knowledge</h1>
          <p className="lede">
            Hearthline Instruments keeps one unit per file. Core routes are the company view. Project files stay where
            they were written. This demo reads the committed Kilnwatch seed and any unit you approve in this session.
          </p>
        </div>
        <form className="cluster" action="/search" method="get">
          <label className="field">
            <span className="label flat">Search units</span>
            <input name="q" type="search" placeholder="Curve, decision, owner" />
          </label>
          <button className="btn" type="submit">
            Search
          </button>
        </form>
      </header>

      {proposed > 0 ? (
        <p className="notice" role="status">
          {proposed} proposed {proposed === 1 ? "unit is" : "units are"} waiting. <Link href="/proposals">Review them</Link>
        </p>
      ) : (
        <p className="meta">
          <Link href="/compile">Compile a transcript</Link> to propose units. Nothing is shared until you approve it.
        </p>
      )}

      <div className="board">
        <section className="stack" aria-labelledby="core-heading">
          <div>
            <h2 id="core-heading">Core</h2>
            <p className="meta">Company scope is a tag. The file does not move. Domain picks the route.</p>
          </div>
          <ul className="queue">
            {CORE_AREAS.map((area) => {
              const count = company.filter((unit) => unit.domain === area.slug).length;
              return (
                <li key={area.slug}>
                  <Link href={`/areas/${area.slug}`}>
                    <span className="queue-title">{area.group === area.title ? area.title : `${area.group} · ${area.title}`}</span>
                    <span className="meta">
                      {count} company {count === 1 ? "unit" : "units"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="stack" aria-labelledby="project-heading">
          <div>
            <h2 id="project-heading">Projects</h2>
            <p className="meta">Units live in projects/{"{id}"}/units/.</p>
          </div>
          {projects.length === 0 ? (
            <p className="panel">No project units yet.</p>
          ) : (
            projects.map((project) => (
              <div key={project.id} className="stack-tight">
                <h3>
                  <Link href={`/work/${project.slug}`}>{project.name}</Link>
                </h3>
                <UnitList units={project.units} />
              </div>
            ))
          )}
        </section>
      </div>

      <section className="stack" id="company" aria-labelledby="company-heading">
        <div>
          <h2 id="company-heading">Company scope</h2>
          <p className="meta">Projected by domain. Empty routes are still part of the tree.</p>
        </div>
        {DOMAINS.map((domain) => (
          <DomainGroup key={domain} domain={domain} units={company.filter((unit) => unit.domain === domain)} />
        ))}
      </section>

      {comps.length > 0 ? (
        <section className="stack" aria-labelledby="comp-heading">
          <h2 id="comp-heading">Compositions</h2>
          <ul className="queue">
            {comps.map((comp) => (
              <li key={comp.id}>
                <Link href="/catalog">
                  <span className="queue-title">{comp.title}</span>
                  <span className="meta">{comp.summary}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

function DomainGroup({ domain, units }: { domain: UnitDomain; units: VisibleUnit[] }) {
  const area = CORE_AREAS.find((item) => item.slug === domain);
  return (
    <div className="stack-tight">
      <h3>
        <Link href={`/areas/${domain}`}>{area?.title ?? domain}</Link>
      </h3>
      {units.length === 0 ? <p className="meta">No company units.</p> : <UnitList units={units} />}
    </div>
  );
}

function UnitList({ units }: { units: VisibleUnit[] }) {
  return (
    <ul className="queue">
      {units.map((unit) => (
        <li key={unit.id}>
          <Link href={`/units/${unit.id}`}>
            <span className="queue-title">{unit.title}</span>
            <span className="meta">
              {TYPE_LABEL[unit.type]} · {unit.scope}
              {unit.domain ? ` · ${unit.domain}` : ""} · {unit.origin === "session" ? "This session" : "Git"}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
