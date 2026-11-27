import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { StatusLabel } from "@/components/status-label";
import { assertCatalog, getCourse, getTiers } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Certification",
};

export default function CertificationPage() {
  assertCatalog();
  const tiers = getTiers();
  return (
    <>
      <PageHeader
        kicker="Marks"
        title="Certification"
        lede="Five proposed tiers. Fees to be announced. The Certification Board issues the mark. A trainer does not. Nothing on this site is a credential you can hold."
      />
      <p>
        <StatusLabel tone="info">Proposed</StatusLabel>
      </p>
      <ul className="tier-list">
        {tiers.map((tier) => {
          const course = getCourse(tier.courseSlug);
          return (
            <li key={tier.slug}>
              <div className="stack-tight">
                <h2>
                  <Link href={`/certification/${tier.slug}`}>{tier.name}</Link>
                </h2>
                <p>{tier.audience}</p>
                <p className="row-meta">
                  {course ? course.title : "Course missing from the catalog"} · {tier.term}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      <section className="stack-tight">
        <h2>Fees</h2>
        <p>To be announced. No tier has a price in this draft.</p>
      </section>
      <section className="stack-tight">
        <h2>Rules that apply to every tier</h2>
        <ul className="plain-list">
          <li>Renewal is not automatic. An expired mark stays public and is not current.</li>
          <li>A revoked mark stays public with status revoked. It is not deleted.</li>
          <li>An examiner does not grade a person they trained, or a person their firm trained in that cohort.</li>
          <li>Credential records are not stored in git. Verify reads the public fields only.</li>
        </ul>
      </section>
      <p className="inline-links">
        <Link href="/verify">Verify a credential</Link>
        <Link href="/directory">Directory</Link>
        <Link href="/governance">Governance and impartiality</Link>
      </p>
    </>
  );
}
