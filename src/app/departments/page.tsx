import Link from "next/link";
import { getContext } from "@/lib/session";

export default async function DepartmentsPage() {
  const { actor, repo } = await getContext();
  if (!actor) {
    return (
      <main className="panel p-6">
        <h1 className="text-4xl">Departments</h1>
        <p className="mt-3">
          <Link href="/login">Sign in</Link> to see your projects.
        </p>
      </main>
    );
  }
  const [departments, projects] = await Promise.all([repo.listDepartments(actor), repo.listProjects(actor)]);
  return (
    <main className="grid gap-4">
      <h1 className="text-4xl">Departments</h1>
      <p className="text-sm text-[var(--muted)]">Projects you cannot access stay off this page.</p>
      {departments.length === 0 ? (
        <section className="panel p-5 text-sm text-[var(--muted)]">No visible departments.</section>
      ) : (
        departments.map((department) => {
          const children = projects.filter((project) => project.departmentId === department.id);
          return (
            <section key={department.id} className="panel p-5">
              <h2 className="text-3xl">{department.name}</h2>
              {children.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--muted)]">No visible projects.</p>
              ) : (
                <ul className="mt-3 grid gap-2">
                  {children.map((project) => (
                    <li key={project.id}>
                      <Link className="underline" href={`/projects/${project.id}`}>
                        {project.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })
      )}
    </main>
  );
}
