import Link from "next/link";
import { notFound } from "next/navigation";
import { areaBySlug, readAreaText, visibleUnits } from "@/lib/desk/read";
import { deskSnapshot } from "@/lib/desk/store";
import { TYPE_LABEL } from "@/lib/frontmatter";

export const dynamic = "force-dynamic";

export default async function AreaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const area = areaBySlug(slug);
  if (!area) notFound();
  const units = visibleUnits(process.cwd(), deskSnapshot()).filter((unit) => unit.scope === "company" && unit.domain === area.slug);
  const prose = readAreaText(process.cwd(), area);

  return (
    <main className="page">
      <header className="page-head">
        <div>
          <p className="crumb">
            <Link href="/">Knowledge</Link>
            {" · "}
            {area.group}
          </p>
          <h1>{area.title}</h1>
          <p className="lede">{prose || area.blurb}</p>
        </div>
      </header>
      <p className="meta">
        Route <span className="mono">{area.file}</span>. Company units stay in the project folder. This page lists the ones tagged {area.slug}.
      </p>
      {units.length === 0 ? (
        <section className="panel">
          <p>No company units use this domain yet. Approve a proposal, then promote it with domain {area.slug}.</p>
        </section>
      ) : (
        <ul className="queue">
          {units.map((unit) => (
            <li key={unit.id}>
              <Link href={`/units/${unit.id}`}>
                <span className="queue-title">{unit.title}</span>
                <span className="meta">
                  {TYPE_LABEL[unit.type]} · {unit.path}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
