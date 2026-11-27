import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { getPhases } from "@/lib/phases";

export const metadata: Metadata = {
  title: "Implement",
};

export default function ImplementPage() {
  const phases = getPhases();
  return (
    <>
      <PageHeader
        kicker="For the sponsor and the steward"
        title="Implement"
        lede="Five phases. The organization stops, learns a common language, builds the registers, captures knowledge in value sessions, and reports velocity to the board."
      />
      <ol className="path">
        {phases.map((phase) => (
          <li key={phase.slug}>
            <Link href={`/implement/${phase.slug}`}>
              <span className="path-num">0{phase.number}</span>
              <span>
                <strong>{phase.name}</strong>
                <span className="path-summary">{phase.summary}</span>
              </span>
            </Link>
            <p className="path-artifact">Artifact: {phase.artifact}</p>
          </li>
        ))}
      </ol>
      <p className="inline-links">
        <Link href="/example">See the registers on the Hearthline example</Link>
        <Link href="/example#pilot">Request a pilot</Link>
      </p>
    </>
  );
}
