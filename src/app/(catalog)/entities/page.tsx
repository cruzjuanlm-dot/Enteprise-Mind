import Link from "next/link";
import { connection } from "next/server";
import { entityAttributes, loadEntities } from "@/lib/entity-read";
import { isPublicSupabaseConfigured } from "@/lib/env";
import { ENTITY_LABEL, ENTITY_TYPES, loadDeclarations, loadSeedEntities, type EntityType } from "@/lib/ontology";

export const metadata = {
  title: "Entities · Enterprise Mind",
  description: "Hearthline entity rows from Supabase, or the committed seed when that read is unavailable.",
};

export default async function EntitiesPage() {
  const declarations = loadDeclarations();
  if (isPublicSupabaseConfigured()) await connection();
  const data = await loadEntities();
  const names = new Map(loadSeedEntities().map((entity) => [entity.id, entity.name]));
  for (const entity of data.entities) names.set(entity.id, entity.name);

  return (
    <main className="grid gap-6">
      <section className="panel p-6">
        <p className="text-sm uppercase tracking-[0.16em] text-[var(--green)]">Hearthline Instruments</p>
        <h1 className="mt-2 text-4xl">Entities</h1>
        <p className="mt-4 max-w-2xl text-[var(--muted)]">
          Git is the authority for knowledge units. Postgres holds entity rows. Each type declares which one is the
          source of truth, and which way a later sync will copy. This page does not run that sync.
        </p>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Showing {data.source === "supabase" ? "Supabase" : "the committed seed"}.{" "}
          <Link href="/catalog">Back to the catalog</Link>
        </p>
        {data.note ? <p className="mt-3 text-sm">{data.note}</p> : null}
      </section>

      <section className="panel overflow-x-auto p-5">
        <h2 className="text-2xl">System of record</h2>
        <table className="mt-3 w-full border-collapse text-sm">
          <caption className="sr-only">Source of truth and mirror direction for each entity type</caption>
          <thead>
            <tr className="border-b border-[var(--line)]">
              <th className="py-2 pr-3 text-left font-medium" scope="col">
                Type
              </th>
              <th className="py-2 pr-3 text-left font-medium" scope="col">
                Source of truth
              </th>
              <th className="py-2 pr-3 text-left font-medium" scope="col">
                Later mirror
              </th>
              <th className="py-2 text-left font-medium" scope="col">
                What the mirror means
              </th>
            </tr>
          </thead>
          <tbody>
            {declarations.map((declaration) => (
              <tr key={declaration.type} className="border-b border-[var(--line)] align-top">
                <th className="py-2 pr-3 text-left font-medium" scope="row">
                  {declaration.title}
                </th>
                <td className="py-2 pr-3">{declaration.sourceOfTruth}</td>
                <td className="py-2 pr-3">{declaration.mirrorDirection}</td>
                <td className="py-2 text-[var(--muted)]">{declaration.mirrorNote}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {ENTITY_TYPES.map((type) => {
        const items = data.entities.filter((entity) => entity.type === type);
        return (
          <section key={type} className="grid gap-3">
            <h2 className="text-3xl">{ENTITY_LABEL[type as EntityType]}</h2>
            {items.length === 0 ? (
              <p className="panel p-4 text-sm text-[var(--muted)]">No rows.</p>
            ) : (
              items.map((entity) => (
                <article key={entity.id} id={entity.id} className="panel scroll-mt-6 p-4">
                  <h3 className="text-2xl">{entity.name}</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">{entity.id}</p>
                  <p className="mt-3">{entity.summary}</p>
                  <dl className="mt-3 grid gap-1 text-sm">
                    {entityAttributes(entity).map((attribute) => (
                      <div key={attribute.label} className="grid grid-cols-[9rem_1fr] gap-2">
                        <dt className="text-[var(--muted)]">{attribute.label}</dt>
                        <dd>{attribute.value}</dd>
                      </div>
                    ))}
                  </dl>
                </article>
              ))
            )}
          </section>
        );
      })}

      <section className="grid gap-3">
        <h2 className="text-3xl">Relationships</h2>
        <ul className="grid gap-2">
          {data.relationships.map((relationship) => (
            <li key={relationship.id} className="panel px-4 py-3 text-sm">
              <span className="text-[var(--muted)]">{relationship.type}</span>
              {" · "}
              <a href={`#${relationship.from}`}>{names.get(relationship.from) ?? relationship.from}</a>
              {" → "}
              <a href={`#${relationship.to}`}>{names.get(relationship.to) ?? relationship.to}</a>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
