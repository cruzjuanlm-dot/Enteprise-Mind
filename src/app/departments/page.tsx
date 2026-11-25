import Link from "next/link";
import { FIXTURES } from "@/lib/fixtures";
import { getContext } from "@/lib/session";

const PROJECT_NOTE: Record<string, string> = {
  [FIXTURES.rolloutProject]: "Shared context for accepted firmware decisions, tasks, and terms.",
  [FIXTURES.restrictedProject]: "Calibration records with a separate project grant.",
  [FIXTURES.otherProject]: "Shared context for accepted records at Bramble Civic Works.",
};

export const metadata = { title: "Departments · Enterprise Mind" };

export default async function DepartmentsPage() {
  const { actor, repo } = await getContext();
  if (!actor) {
    return (
      <main className="page">
        <h1>Departments</h1>
        <p className="lede">
          <Link href="/login">Sign in</Link> to see company, department, and project context.
        </p>
      </main>
    );
  }

  const [departments, projects] = await Promise.all([repo.listDepartments(actor), repo.listProjects(actor)]);
  const tenantIds = [...new Set(departments.map((department) => department.tenantId))];
  const tenants = (await Promise.all(tenantIds.map((id) => repo.getTenant(id)))).filter((tenant) => tenant !== null);

  return (
    <main className="page">
      <header className="page-head">
        <div>
          <h1>Departments</h1>
          <p className="lede">
            Company, department, and project context for this session. Projects you cannot access are omitted, including
            their names.
          </p>
        </div>
      </header>
      {departments.length === 0 ? (
        <section className="panel stack-tight">
          <h2>No visible departments</h2>
          <p>This account has no project grants.</p>
        </section>
      ) : (
        <div className="taxonomy">
          {tenants.map((tenant) => (
            <section key={tenant.id} aria-labelledby={`tenant-${tenant.id}`}>
              <h2 id={`tenant-${tenant.id}`}>{tenant.name}</h2>
              {departments
                .filter((department) => department.tenantId === tenant.id)
                .map((department) => {
                  const children = projects.filter((project) => project.departmentId === department.id);
                  return (
                    <div key={department.id} className="follow">
                      <h3 className="label flat">{department.name}</h3>
                      {children.length === 0 ? (
                        <p className="meta">No visible projects.</p>
                      ) : (
                        <ul className="project-list">
                          {children.map((project) => (
                            <li key={project.id}>
                              <Link href={`/projects/${project.id}`}>{project.name}</Link>
                              {PROJECT_NOTE[project.id] ? <span className="meta"> — {PROJECT_NOTE[project.id]}</span> : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
