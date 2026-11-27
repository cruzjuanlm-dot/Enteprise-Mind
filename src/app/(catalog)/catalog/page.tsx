import Link from "next/link";
import { entityNames, listComps, listUnits } from "@/lib/catalog";
import { DOMAINS, DOMAIN_ROUTE, TYPE_BLURB, TYPE_CODES, TYPE_LABEL } from "@/lib/frontmatter";

export const dynamic = "force-static";

export const metadata = {
  title: "Catalog · Enterprise Mind",
  description: "Governed Hearthline knowledge units, one file per unit.",
};

export default function CatalogPage() {
  const units = listUnits();
  const names = entityNames();
  const comps = listComps();
  const company = units.filter((unit) => unit.scope === "company");
  return (
    <main className="page">
      <header className="page-head">
        <div>
          <p className="meta">Hearthline Instruments</p>
          <h1>Knowledge catalog</h1>
          <p className="lede">
            Each unit is one Markdown file under the project that produced it. Company scope is a tag plus a domain.
            The file does not move. Entity rows are listed on the entities page.
          </p>
        </div>
      </header>
      <section className="stack" aria-labelledby="domain-heading">
        <div>
          <h2 id="domain-heading">Company routes</h2>
          <p className="meta">Filter by domain. These routes do not hold the files.</p>
        </div>
        <nav className="filters" aria-label="Domain">
          {DOMAINS.map((domain) => (
            <a key={domain} href={`#domain-${domain}`}>
              {domain}
            </a>
          ))}
        </nav>
        {DOMAINS.map((domain) => {
          const items = company.filter((unit) => unit.domain === domain);
          return (
            <div key={domain} id={`domain-${domain}`} className="stack-tight">
              <h3>
                <span className="mono">{DOMAIN_ROUTE[domain]}</span>
              </h3>
              {items.length === 0 ? (
                <p className="meta">No company units.</p>
              ) : (
                <ul className="queue">
                  {items.map((unit) => (
                    <li key={unit.id}>
                      <Link href={`/catalog/${unit.id}`}>{unit.title}</Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </section>
      {TYPE_CODES.map((type) => {
        const items = units.filter((unit) => unit.type === type);
        return (
          <section key={type} className="grid gap-3">
            <div>
            <h2>{TYPE_LABEL[type]}</h2>
              <p className="text-sm text-[var(--muted)]">{TYPE_BLURB[type]}</p>
            </div>
            {items.length === 0 ? (
              <p className="panel p-4 text-sm text-[var(--muted)]">No units of this type yet.</p>
            ) : (
              items.map((unit) => (
                <article key={unit.id} className="panel p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3>
                      <Link href={`/catalog/${unit.id}`}>{unit.title}</Link>
                    </h3>
                    <span className="chip" data-status={unit.status}>
                      {unit.status}
                    </span>
                    <span className="chip">{unit.scope}</span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {unit.id} · Version {unit.version} · {names.get(unit.owner) ?? unit.owner}
                  </p>
                </article>
              ))
            )}
          </section>
        );
      })}
      <section className="grid gap-3">
        <div>
            <h2>Compositions</h2>
          <p className="text-sm text-[var(--muted)]">A composition points at units that belong in one reading.</p>
        </div>
        {comps.map((comp) => (
          <article key={comp.id} className="panel p-4">
            <h3>{comp.title}</h3>
            <p className="mt-2 text-[var(--muted)]">{comp.summary}</p>
            <ul className="mt-3 flex flex-wrap gap-3 text-sm">
              {comp.units.map((unitId) => {
                const unit = units.find((item) => item.id === unitId);
                return (
                  <li key={unitId}>
                    {unit ? <Link href={`/catalog/${unit.id}`}>{unit.title}</Link> : unitId}
                  </li>
                );
              })}
            </ul>
          </article>
        ))}
      </section>
    </main>
  );
}
