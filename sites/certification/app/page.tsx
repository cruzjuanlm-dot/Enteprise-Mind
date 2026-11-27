import type { Metadata } from "next";
import Link from "next/link";
import { ValueCycleFigure } from "@/components/value-cycle-figure";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: "Flux certification" },
};

const figureLabel =
  "Value cycle. The ring runs from Outside knowledge, through a gap marked Big Pause, to Organized, Value session, and Actionable value. Velocity, in the center, is average days per cycle. Enterprise debt crosses the ring.";

export default function HomePage() {
  return (
    <>
      <header className="page-header">
        <p className="kicker">
          Flux standard v{site.version} · {site.status}
        </p>
        <h1 className="display">
          Flux is an open standard for turning outside knowledge into records a team can act on.
          Learn it, get certified, or implement it.
        </h1>
        <p className="lede">
          Anyone can read the text. A certification mark is issued and checked by Flux, not by a
          piece of software. The Flux tool is a working register. The standard is the durable part.
        </p>
      </header>
      <section className="stack-tight" aria-labelledby="cycle-title">
        <h2 id="cycle-title">The value cycle</h2>
        <ValueCycleFigure active={null} label={figureLabel} />
        <Link className="text-target" href="/value-cycle">
          Explain each part
        </Link>
      </section>
      <section aria-labelledby="doors-title">
        <h2 id="doors-title">Start here</h2>
        <ol className="doors">
          <li>
            <span className="door-index">01</span>
            <div className="stack-tight">
              <h3>Learn</h3>
              <p>Read the draft, then the course a candidate actually sits.</p>
              <p className="door-links">
                <Link href="/standard">The standard</Link>
                <Link href="/courses">Courses</Link>
              </p>
            </div>
          </li>
          <li>
            <span className="door-index">02</span>
            <div className="stack-tight">
              <h3>Get certified</h3>
              <p>Five proposed tiers. Fees to be announced. A trainer does not issue the mark.</p>
              <p className="door-links">
                <Link href="/certification">Certification</Link>
                <Link href="/verify">Verify a credential</Link>
              </p>
            </div>
          </li>
          <li>
            <span className="door-index">03</span>
            <div className="stack-tight">
              <h3>Implement</h3>
              <p>Five phases, from the signed pause to the board report.</p>
              <p className="door-links">
                <Link href="/implement">The path</Link>
                <Link href="/example">Hearthline example</Link>
              </p>
            </div>
          </li>
        </ol>
      </section>
      <p className="lede">
        Written for the sponsor and the steward, the practitioner and the master, and the wider
        group that only needs the language. Consultancies that teach are listed under{" "}
        <Link href="/partners">Partners</Link>. An employer checks a mark on{" "}
        <Link href="/verify">Verify</Link>.
      </p>
    </>
  );
}
