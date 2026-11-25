import Link from "next/link";
import { entityNames, listComps, listUnits } from "@/lib/catalog";
import { TYPE_BLURB, TYPE_CODES, TYPE_LABEL } from "@/lib/frontmatter";

export const dynamic = "force-static";

export const metadata = {
  title: "Catalog · Enterprise Mind",
  description: "Governed Hearthline knowledge units, one file per unit.",
};

export default function CatalogPage() {
  const units = listUnits();
  const names = entityNames();
  const comps = listComps();
  return (
    <main className="grid gap-6">
      <section className="panel p-6">
        <p className="text-sm uppercase tracking-[0.16em] text-[var(--green)]">Hearthline Instruments</p>
        <h1 className="mt-2 text-4xl">Knowledge catalog</h1>
        <p className="mt-4 max-w-2xl text-[var(--muted)]">
          Each unit is one Markdown file under the project that produced it. Company scope is a tag in that file.
          The version log is the git history. Entity rows are listed on the entities page.
        </p>
      </section>
      {TYPE_CODES.map((type) => {
        const items = units.filter((unit) => unit.type === type);
        return (
          <section key={type} className="grid gap-3">
            <div>
              <h2 className="text-3xl">{TYPE_LABEL[type]}</h2>
              <p className="text-sm text-[var(--muted)]">{TYPE_BLURB[type]}</p>
            </div>
            {items.length === 0 ? (
              <p className="panel p-4 text-sm text-[var(--muted)]">No units of this type yet.</p>
            ) : (
              items.map((unit) => (
                <article key={unit.id} className="panel p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-2xl">
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
          <h2 className="text-3xl">Compositions</h2>
          <p className="text-sm text-[var(--muted)]">A composition points at units that belong in one reading.</p>
        </div>
        {comps.map((comp) => (
          <article key={comp.id} className="panel p-4">
            <h3 className="text-2xl">{comp.title}</h3>
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
