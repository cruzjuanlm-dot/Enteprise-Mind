import Link from "next/link";
import { notFound } from "next/navigation";
import { RichText } from "@/components/rich-text";
import { entityNames, listUnits, readUnit } from "@/lib/catalog";
import { TYPE_LABEL, type TypeCode } from "@/lib/frontmatter";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return listUnits().map((unit) => ({ id: unit.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const unit = listUnits().find((item) => item.id === id);
  return { title: unit ? `${unit.title} · Enterprise Mind` : "Unit · Enterprise Mind" };
}

export default async function UnitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = listUnits().find((item) => item.id === id);
  if (!entry) notFound();
  const unit = readUnit(entry);
  const names = entityNames();
  return (
    <main className="grid gap-6">
      <article className="panel p-6">
        <p className="text-sm text-[var(--muted)]">
          <Link href="/catalog">Catalog</Link>
          {" · "}
          {TYPE_LABEL[unit.entry.type as TypeCode]}
          {" · "}
          <span className="chip" data-status={unit.entry.status}>
            {unit.entry.status}
          </span>
          {" · "}
          <span className="chip">{unit.entry.scope}</span>
        </p>
        <h1 className="mt-3 text-4xl">{unit.entry.title}</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">
          {unit.entry.id} · Version {unit.entry.version} · Owner {names.get(unit.entry.owner) ?? unit.entry.owner}
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Project {names.get(unit.entry.project) ?? unit.entry.project} · Source {unit.entry.sourceId}
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Git history of <code>{unit.entry.path}</code> is the version log. The version number is a label in the file.
          {unit.entry.supersedes ? ` This unit supersedes ${unit.entry.supersedes}.` : ""}
        </p>
        <div className="mt-6">
          <RichText markdown={unit.body} />
        </div>
      </article>
      <section className="panel p-5">
        <h2 className="text-2xl">Entities</h2>
        <ul className="mt-3 grid gap-2 text-sm">
          {unit.entry.entities.map((entityId) => (
            <li key={entityId}>
              <Link href={`/entities#${entityId}`}>{names.get(entityId) ?? entityId}</Link>
              <span className="text-[var(--muted)]"> · {entityId}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
