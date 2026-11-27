import Link from "next/link";
import { notFound } from "next/navigation";
import { projectsIn, visibleUnits } from "@/lib/desk/read";
import { deskSnapshot } from "@/lib/desk/store";
import { TYPE_LABEL } from "@/lib/frontmatter";
import { loadSeedEntities } from "@/lib/ontology";

export const dynamic = "force-dynamic";

export default async function WorkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const names = new Map(loadSeedEntities().map((entity) => [entity.id, entity.name]));
  const project = projectsIn(visibleUnits(process.cwd(), deskSnapshot()), names).find((item) => item.slug === slug);
  if (!project) notFound();

  return (
    <main className="page">
      <header className="page-head">
        <div>
          <p className="crumb">
            <Link href="/">Knowledge</Link>
          </p>
          <h1>{project.name}</h1>
          <p className="meta mono">{project.id}</p>
        </div>
      </header>
      <ul className="queue">
        {project.units.map((unit) => (
          <li key={unit.id}>
            <Link href={`/units/${unit.id}`}>
              <span className="queue-title">{unit.title}</span>
              <span className="meta">
                {TYPE_LABEL[unit.type]} · {unit.scope}
                {unit.scope === "company" && unit.domain ? ` · ${unit.domain}` : ""} · {unit.origin === "session" ? "This session" : "Git"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
