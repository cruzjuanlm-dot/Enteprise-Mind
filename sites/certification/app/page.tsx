import type { Metadata } from "next";
import Link from "next/link";
import { ValueCycleFigure } from "@/components/value-cycle-figure";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: "Flux certification" },
};

const figureLabel =
  "A broken ring. Knowledge moves from outside the organization, through the Big Pause, into organized form, through a value session, and on to actionable value. Velocity sits at the center, in days. Enterprise debt cuts across the turn.";

export default function HomePage() {
  return (
    <>
      <header className="page-header">
        <p className="kicker">
          Flux standard v{site.version} · {site.status}
        </p>
        <h1 className="promise">
          Knowledge from outside an organization becomes a record someone can act on, and the
          people who do that work can be certified.
        </h1>
        <p className="lede">
          The text of the standard is open. The marks are controlled. The Flux tool is the
          register and the proof of concept, not the asset.
        </p>
      </header>
      <section className="stack-tight" aria-labelledby="cycle-title">
        <h2 id="cycle-title">The value cycle</h2>
        <ValueCycleFigure active={null} label={figureLabel} />
        <p className="lede">
          1 Outside knowledge. 2 Big Pause, the break in the ring. 3 Organized. 4 Value session.
          5 Actionable value. Velocity is the days at the center. Enterprise debt is the line
          that cuts the turn.
        </p>
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
