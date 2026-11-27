import Link from "next/link";
import { searchUnits, visibleUnits } from "@/lib/desk/read";
import { deskSnapshot } from "@/lib/desk/store";
import { TYPE_LABEL } from "@/lib/frontmatter";
import { loadSeedEntities } from "@/lib/ontology";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const names = new Map(loadSeedEntities().map((entity) => [entity.id, entity.name]));
  const matches = query ? searchUnits(visibleUnits(process.cwd(), deskSnapshot()), query, names) : [];

  return (
    <main className="page">
      <header className="page-head">
        <div>
          <h1>Search</h1>
          <p className="lede">Titles, bodies, ids, owners, and entity names. The reader does not search discarded transcripts.</p>
        </div>
      </header>
      <form className="cluster" action="/search" method="get">
        <label className="field">
          <span className="label flat">Query</span>
          <input name="q" type="search" defaultValue={query} />
        </label>
        <button className="btn" type="submit">
          Search
        </button>
      </form>
      {query ? (
        <p className="meta">
          {matches.length} {matches.length === 1 ? "unit" : "units"} for “{query}”.
        </p>
      ) : (
        <p className="meta">Enter a word from a unit.</p>
      )}
      <ul className="queue">
        {matches.map((unit) => (
          <li key={unit.id}>
            <Link href={`/units/${unit.id}`}>
              <span className="queue-title">{unit.title}</span>
              <span className="meta">
                {TYPE_LABEL[unit.type]} · {unit.scope}
                {unit.domain ? ` · ${unit.domain}` : ""}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
