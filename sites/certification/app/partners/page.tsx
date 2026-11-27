import type { Metadata } from "next";
import Link from "next/link";
import { DisabledForm } from "@/components/disabled-form";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Partners",
};

export default function PartnersPage() {
  return (
    <>
      <PageHeader
        kicker="Train the trainer"
        title="Partners"
        lede="Consultancies that deploy large systems are the partners this standard is written for. They teach. The Certification Board examines. The firm that ran the course does not grade it."
      />
      <section className="stack-tight" aria-labelledby="ttt-title">
        <h2 id="ttt-title">Train the trainer</h2>
        <p className="lede">
          The trainer course is a comp, registry id comp.train-the-trainer. It assumes an active
          Master credential. A trainer license is not included in that mark. Renewal is two years
          and requires a delivery the Board observed, plus a record that the trainer graded nobody
          from that delivery. Proposed.
        </p>
      </section>
      <section className="stack-tight" aria-labelledby="alliance-title">
        <h2 id="alliance-title">Consultancy alliance</h2>
        <p className="lede">
          A consultancy teaches the client stewards and practitioners from the published comps.
          It does not write a private dialect of the terms. It does not issue FLX ids. Candidates
          from that engagement are examined by someone outside the firm. That is the whole of the
          commercial model in this draft: teach under license, examine under the Board.
        </p>
      </section>
      <p className="inline-links">
        <Link href="/certification/trainer">Trainer tier and blueprint</Link>
        <Link href="/courses/train-the-trainer">The course</Link>
        <Link href="/governance">Why examiners are separate</Link>
      </p>
      <DisabledForm
        id="request-a-call"
        title="Request a call"
        note="This form is disabled. The prototype does not send requests and does not book calls."
        submitLabel="Request a call"
        fields={[
          { name: "name", label: "Name" },
          { name: "organization", label: "Organization" },
          { name: "role", label: "Role: consultancy or trainer" },
          { name: "email", label: "Email", type: "email" },
          { name: "topic", label: "What you want to teach or deploy", multiline: true },
        ]}
      />
    </>
  );
}
