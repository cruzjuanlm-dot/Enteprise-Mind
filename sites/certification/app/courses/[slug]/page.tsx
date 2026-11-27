import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import {
  assertCatalog,
  getCourse,
  getCourses,
  prerequisiteCourse,
  tierForCourse,
} from "@/lib/catalog";

type Params = { slug: string };

export function generateStaticParams() {
  return getCourses().map((course) => ({ slug: course.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const course = getCourse(slug);
  return { title: course ? course.title : "Course" };
}

export default async function CoursePage({ params }: { params: Promise<Params> }) {
  assertCatalog();
  const { slug } = await params;
  const course = getCourse(slug);
  if (!course) notFound();
  const prerequisite = prerequisiteCourse(course);
  const tier = tierForCourse(course.slug);
  return (
    <>
      <PageHeader kicker={course.level} title={course.title} lede={course.summary} />
      <dl className="meta-grid">
        <dt>Hours</dt>
        <dd>{course.hours}</dd>
        <dt>Format</dt>
        <dd>{course.format}</dd>
        <dt>Registry id</dt>
        <dd className="mono">{course.registryId}</dd>
        <dt>Prerequisite</dt>
        <dd>
          {prerequisite ? (
            <Link href={`/courses/${prerequisite.slug}`}>{prerequisite.title}</Link>
          ) : (
            "None"
          )}
        </dd>
        <dt>Tier</dt>
        <dd>
          {tier ? <Link href={`/certification/${tier.slug}`}>{tier.name}</Link> : "Not linked"}
        </dd>
      </dl>
      <section className="stack-tight" aria-labelledby="modules-title">
        <h2 id="modules-title">Modules</h2>
        <ol className="plain-list">
          {course.modules.map((module) => (
            <li key={module}>{module}</li>
          ))}
        </ol>
      </section>
      <section className="stack-tight" aria-labelledby="outcomes-title">
        <h2 id="outcomes-title">Outcomes</h2>
        <ul className="plain-list">
          {course.outcomes.map((outcome) => (
            <li key={outcome}>{outcome}</li>
          ))}
        </ul>
      </section>
      {tier ? (
        <p className="inline-links">
          <Link href={`/certification/${tier.slug}`}>
            {tier.name} tier: prerequisites, blueprint, renewal
          </Link>
        </p>
      ) : null}
    </>
  );
}
