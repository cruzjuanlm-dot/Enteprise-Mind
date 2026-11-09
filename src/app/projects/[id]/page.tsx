import Link from "next/link";
import { notFound } from "next/navigation";
import { UnitPanel } from "@/components/unit-panel";
import { canIngest } from "@/lib/authz";
import { getContext } from "@/lib/session";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actor, repo } = await getContext();
  if (!actor) return { title: "Project · Enterprise Mind" };
  const project = await repo.visibleProject(actor, id);
  return { title: project ? `${project.name} · Enterprise Mind` : "Project · Enterprise Mind" };
}

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actor, repo } = await getContext();
  if (!actor) notFound();
  const project = await repo.visibleProject(actor, id);
  if (!project) notFound();
  const [units, department, tenant] = await Promise.all([
    repo.listProjectUnits(actor, project.id),
    repo.getDepartment(project.departmentId),
    repo.getTenant(project.tenantId),
  ]);
  const canSubmit = canIngest(actor, project.tenantId);

  return (
    <main className="page">
      <nav className="crumb" aria-label="Breadcrumb">
        <Link href="/departments">Departments</Link>
        {tenant ? ` / ${tenant.name}` : ""}
        {department ? ` / ${department.name}` : ""}
        {` / ${project.name}`}
      </nav>
      <header className="page-head">
        <div>
          <h1>{project.name}</h1>
          <p className="lede">
            Accepted units are the shared context for this project. Members can read them. Proposed and rejected units
            stay in the review queue and are not listed here.
          </p>
        </div>
      </header>
      <p className="meta">
        {units.length} accepted {units.length === 1 ? "unit" : "units"}.
      </p>
      {units.length === 0 ? (
        <section className="panel stack-tight">
          <h2>No accepted units</h2>
          <p>
            {canSubmit ? (
              <>
                <Link href="/review">Accept a proposal</Link> to publish it into this context. Nothing is shared before
                that.
              </>
            ) : (
              "A reviewer has not accepted any units on this project."
            )}
          </p>
        </section>
      ) : (
        units.map((unit) => <UnitPanel key={unit.id} unit={unit} projectName={project.name} />)
      )}
    </main>
  );
}
