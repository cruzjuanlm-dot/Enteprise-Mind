import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { assertCatalog, coursesByLevel } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Courses",
};

export default function CoursesPage() {
  assertCatalog();
  const groups = coursesByLevel();
  return (
    <>
      <PageHeader
        kicker="Catalog"
        title="Courses"
        lede="Five courses, one per proposed tier. Each course is a comp: a versioned container with a registry id, the same kind of id the Flux tool reads."
      />
      {groups.map((group) => (
        <section key={group.level} aria-labelledby={`level-${group.level}`} className="stack-tight">
          <h2 id={`level-${group.level}`}>{group.level}</h2>
          {group.courses.length === 0 ? (
            <div className="state state-empty">
              <h3>No course at this level</h3>
              <p>The catalog has no course filed under {group.level}.</p>
            </div>
          ) : (
            <ul className="index-list">
              {group.courses.map((course) => (
                <li key={course.slug}>
                  <Link className="row-link" href={`/courses/${course.slug}`}>
                    <span className="row-title">{course.title}</span>
                    <span className="row-summary">{course.summary}</span>
                    <span className="row-meta">
                      {course.hours} hours · {course.format} · {course.registryId}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
      <p className="inline-links">
        <Link href="/certification">What each course is examined as</Link>
      </p>
    </>
  );
}
