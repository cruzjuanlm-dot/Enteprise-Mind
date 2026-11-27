import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Governance",
};

export default function GovernancePage() {
  return (
    <>
      <PageHeader
        kicker="Two bodies"
        title="Governance"
        lede="The Standards Council keeps the text. The Certification Board keeps the marks. Training and examination are not the same work, and they are not done by the same person for the same candidate."
      />
      <section className="stack-tight" aria-labelledby="council-title">
        <h2 id="council-title">Standards Council</h2>
        <p className="lede">
          The Council maintains Flux Standard. It moves a version from Draft to Candidate to
          Final. It records objections against a section. It does not issue a credential and it
          does not grade a practical.
        </p>
      </section>
      <section className="stack-tight" aria-labelledby="board-title">
        <h2 id="board-title">Certification Board</h2>
        <p className="lede">
          The Board owns the blueprints, and it issues, renews, and revokes marks. A mark is an
          action of the Board, not a git commit. Fees are to be announced. This prototype does
          not carry out any of those actions.
        </p>
      </section>
      <section className="stack-tight" aria-labelledby="impartial-title">
        <h2 id="impartial-title">Impartiality</h2>
        <p className="lede">
          An examiner does not grade a candidate they trained. An examiner does not grade a
          candidate trained by their firm in that cohort. A consultancy may teach a client. That
          consultancy does not certify the client people. The separation is the licensing model,
          not a preference.
        </p>
      </section>
      <section className="stack-tight" aria-labelledby="license-title">
        <h2 id="license-title">Licensing</h2>
        <p className="lede">
          The text of the standard is licensed under{" "}
          <a href="https://creativecommons.org/licenses/by/4.0/" rel="noreferrer" target="_blank">
            CC BY 4.0
          </a>
          . You may copy it and adapt it, with attribution. The marks are not in that license.
          Flux used as a credential, the tier titles used as a credential, and the credential ids
          are controlled by the Certification Board. Teaching the terms is allowed. Issuing a
          mark is not, unless the Board has licensed the examination.
        </p>
        <p className="lede">
          The Flux tool is a separate work. Using it does not grant a mark. Holding a mark does
          not assign any right in the tool.
        </p>
      </section>
      <section className="stack-tight" aria-labelledby="trainer-title">
        <h2 id="trainer-title">Trainer program</h2>
        <p className="lede">
          A licensed trainer delivers a course from its comp. The license is separate from the
          Master mark and renews on its own term. Proposed. The trainer does not sit on the panel
          for their own cohort.
        </p>
      </section>
      <p className="inline-links">
        <Link href="/certification/trainer">Trainer tier</Link>
        <Link href="/partners">Become a trainer or a partner</Link>
        <Link href="/standard#impartiality">Impartiality in the standard</Link>
      </p>
    </>
  );
}
