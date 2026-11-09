import Link from "next/link";
import { notFound } from "next/navigation";
import { UNIT_LABEL } from "@/lib/present";
import { getContext } from "@/lib/session";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actor, repo } = await getContext();
  if (!actor) notFound();
  const project = await repo.visibleProject(actor, id);
  if (!project) notFound();
  const [units, departments] = await Promise.all([
    repo.listProjectUnits(actor, project.id),
    repo.listDepartments(actor),
  ]);
  const department = departments.find((item) => item.id === project.departmentId);

  return (
    <main className="grid gap-4">
      <p className="text-sm text-[var(--muted)]">
        <Link href="/departments">Departments</Link>
        {department ? ` / ${department.name}` : ""}
      </p>
      <h1 className="text-4xl">{project.name}</h1>
      <p className="text-sm text-[var(--muted)]">Accepted units only. Proposed units stay in the review queue.</p>
      {units.length === 0 ? (
        <section className="panel p-5 text-sm text-[var(--muted)]">No accepted units yet.</section>
      ) : (
        units.map((unit) => (
          <article key={unit.id} className="panel p-5">
            <p className="text-sm text-[var(--green)]">{UNIT_LABEL[unit.unitType]}</p>
            <h2 className="text-2xl">{unit.title}</h2>
            <p className="mt-2">{unit.body}</p>
          </article>
        ))
      )}
    </main>
  );
}
