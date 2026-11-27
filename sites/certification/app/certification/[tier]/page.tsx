import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { StatusLabel } from "@/components/status-label";
import { assertCatalog, getCourse, getTier, getTiers } from "@/lib/catalog";
import { listCredentials } from "@/lib/verify";

type Params = { tier: string };

export function generateStaticParams() {
  return getTiers().map((tier) => ({ tier: tier.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { tier: slug } = await params;
  const tier = getTier(slug);
  return { title: tier ? tier.name : "Tier" };
}

export default async function TierPage({ params }: { params: Promise<Params> }) {
  assertCatalog();
  const { tier: slug } = await params;
  const tier = getTier(slug);
  if (!tier) notFound();
  const course = getCourse(tier.courseSlug);
  const samples = listCredentials().filter((credential) => credential.tier === tier.slug);
  return (
    <>
      <PageHeader kicker="Proposed tier" title={tier.name} lede={tier.audience} />
      <p>
        <StatusLabel tone="info">Proposed</StatusLabel>
      </p>
      <dl className="meta-grid">
        <dt>Course</dt>
        <dd>
          {course ? (
            <Link href={`/courses/${course.slug}`}>{course.title}</Link>
          ) : (
            "Missing from the catalog"
          )}
        </dd>
        <dt>Registry id</dt>
        <dd className="mono">{course?.registryId ?? "—"}</dd>
        <dt>Fees</dt>
        <dd>To be announced.</dd>
      </dl>
      <section className="stack-tight" aria-labelledby="prereq-title">
        <h2 id="prereq-title">Prerequisites</h2>
        <ul className="plain-list">
          {tier.prerequisites.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      <section className="stack-tight" aria-labelledby="blueprint-title">
        <h2 id="blueprint-title">Assessment blueprint</h2>
        <div className="table-wrap">
          <table>
            <caption className="note">What an examiner would grade. Not offered in this prototype.</caption>
            <thead>
              <tr>
                <th>Part</th>
                <th>Weight</th>
                <th>What is covered</th>
              </tr>
            </thead>
            <tbody>
              {tier.assessment.map((part) => (
                <tr key={part.part}>
                  <th scope="row">{part.part}</th>
                  <td className="mono">{part.weight}</td>
                  <td>{part.covers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="stack-tight" aria-labelledby="renewal-title">
        <h2 id="renewal-title">Renewal</h2>
        <p className="lede">{tier.renewal}</p>
      </section>
      <section className="stack-tight" aria-labelledby="sample-title">
        <h2 id="sample-title">Sample credential</h2>
        {samples.length === 0 ? (
          <div className="state state-empty">
            <h3>None in the prototype</h3>
            <p>No sample credential for this tier is in the public register.</p>
          </div>
        ) : (
          <ul className="sample-list">
            {samples.map((credential) => (
              <li key={credential.id}>
                <Link href={`/verify/${credential.id}`}>
                  <span className="mono">{credential.id}</span>
                  <span>{credential.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="inline-links">
        <Link href="/certification">All tiers</Link>
        <Link href="/governance">Who may examine</Link>
        {course ? <Link href={`/courses/${course.slug}`}>Course detail</Link> : null}
      </p>
    </>
  );
}
