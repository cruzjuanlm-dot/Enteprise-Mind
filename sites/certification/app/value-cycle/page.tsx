import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ValueCycleExplorer } from "@/components/value-cycle-explorer";

export const metadata: Metadata = {
  title: "The value cycle",
};

export default function ValueCyclePage() {
  return (
    <>
      <PageHeader
        kicker="The value cycle"
        title="From outside knowledge to a record someone can use"
        lede="Select a part of the ring. Velocity is the time the turn takes. Enterprise debt is what makes the next turn slower. The Big Pause is the break before any project starts."
      />
      <ValueCycleExplorer />
      <section className="stack-tight">
        <h2>Where this shows up</h2>
        <p className="lede">
          The Hearthline example files one decision from outside the bench: firing recordings stay
          out of the database. That unit is actionable value. The unsigned pause and the unnamed
          fate of Glaze Notebook are still debt.
        </p>
        <p className="inline-links">
          <Link href="/example">Hearthline example</Link>
          <Link href="/implement/big-pause">Phase 1, Big Pause</Link>
          <Link href="/standard#cycle">The standard, the cycle</Link>
        </p>
      </section>
    </>
  );
}
