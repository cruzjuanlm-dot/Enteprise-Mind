import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment } from "react";
import { BoardReport } from "@/components/board-report";
import { PageHeader } from "@/components/page-header";
import { getHearthlineReport } from "@/lib/hearthline";
import { getPhase, getPhases, neighborPhases } from "@/lib/phases";

type Params = { phase: string };

const learnerMap = [
  ["Executive sponsor", "Signs the pause and the board report", "The Flux language"],
  ["P. Ibarra", "Steward candidate", "The Flux language, Foundations, Steward practice"],
  ["Mara Ellison", "Practitioner candidate, Field Systems", "The Flux language, Foundations"],
  ["Calibration owner", "Bench procedure", "Foundations"],
  ["Studio lead", "Teaching day", "The Flux language"],
];

export function generateStaticParams() {
  return getPhases().map((phase) => ({ phase: phase.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { phase: slug } = await params;
  const phase = getPhase(slug);
  return { title: phase ? phase.name : "Phase" };
}

export default async function PhasePage({ params }: { params: Promise<Params> }) {
  const { phase: slug } = await params;
  const phase = getPhase(slug);
  if (!phase) notFound();
  const { previous, next } = neighborPhases(phase.slug);
  const report = getHearthlineReport();
  return (
    <>
      <PageHeader
        kicker={`Phase ${phase.number} of 5`}
        title={phase.name}
        lede={phase.summary}
      />
      <section className="stack-tight">
        <h2>What the organization does</h2>
        <p className="lede">{phase.work}</p>
      </section>
      <dl className="meta-grid">
        <dt>Signed by</dt>
        <dd>{phase.signedBy}</dd>
        <dt>Artifact</dt>
        <dd>{phase.artifact}</dd>
      </dl>
      {phase.slug === "big-learn" ? (
        <section className="stack-tight" aria-labelledby="map-title">
          <h2 id="map-title">Learner map, unsigned sample</h2>
          <p className="note">
            Hearthline Instruments, Kilnwatch. This map is not signed. Big Learn is not finished.
            Mara Ellison is the only row with a public mark in the prototype, FLX-P-1042.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Who</th>
                  <th>Responsibility</th>
                  <th>Courses</th>
                </tr>
              </thead>
              <tbody>
                {learnerMap.map((row) => (
                  <tr key={row[0]}>
                    {row.map((cell, index) => (
                      <td key={`${row[0]}-${index}`}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="inline-links">
            <Link href="/courses/flux-language">The Flux language</Link>
            <Link href="/courses/foundations">Foundations</Link>
            <Link href="/courses/steward-practice">Steward practice</Link>
          </p>
        </section>
      ) : null}
      {phase.slug === "discovery" ? (
        <section className="stack-tight" aria-labelledby="scores-title">
          <h2 id="scores-title">Readiness on the sample</h2>
          <p className="note">The same five scores as the Hearthline board report. Not an average.</p>
          <dl className="metric-list">
            {report.readiness.map((axis) => (
              <Fragment key={axis.axis}>
                <dt>{axis.axis}</dt>
                <dd>{axis.score} / 5</dd>
              </Fragment>
            ))}
          </dl>
          <p className="inline-links">
            <Link href="/example#readiness">Radar on the Hearthline example</Link>
          </p>
        </section>
      ) : null}
      {phase.slug === "board-report" ? (
        <div id="report">
          <BoardReport />
        </div>
      ) : null}
      <div className="download-list">
        {phase.downloads.map((download) => (
          <a key={download.href} className="button secondary" href={download.href} download>
            {download.label}
          </a>
        ))}
      </div>
      <p className="inline-links">
        {previous ? (
          <Link href={`/implement/${previous.slug}`}>Previous: {previous.name}</Link>
        ) : (
          <Link href="/implement">All five phases</Link>
        )}
        {next ? <Link href={`/implement/${next.slug}`}>Next: {next.name}</Link> : null}
        <Link href="/example">Hearthline example</Link>
        <Link href="/example#pilot">Request a pilot</Link>
      </p>
    </>
  );
}
