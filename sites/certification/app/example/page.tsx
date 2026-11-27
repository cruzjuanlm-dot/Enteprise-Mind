import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { BoardReport } from "@/components/board-report";
import { DisabledForm } from "@/components/disabled-form";
import { MarkdownBlock } from "@/components/markdown-block";
import { PageHeader } from "@/components/page-header";
import { PortalMocks } from "@/components/portal-mocks";
import { ReadinessRadar } from "@/components/readiness-radar";
import { RepoTree } from "@/components/repo-tree";
import { loadExampleUnit } from "@/lib/example-unit";
import { getHearthlineReport } from "@/lib/hearthline";
import { exampleTree } from "@/lib/tree";

export const metadata: Metadata = {
  title: "Hearthline example",
};

export default function ExamplePage() {
  const unit = loadExampleUnit();
  const report = getHearthlineReport();
  const fields = parseFrontmatter(unit.frontmatter);
  return (
    <>
      <PageHeader
        kicker="Read-only sandbox"
        title="Hearthline example"
        lede="Hearthline Instruments, Field Systems, project Kilnwatch. Fictional. The tree is the approved layout. One accepted unit is shown with its frontmatter. The radar and the board report use the same five scores."
      />
      <nav className="toc" aria-label="On this page">
        <a href="#tree">Repository tree</a>
        <a href="#unit">Unit</a>
        <a href="#readiness">Readiness</a>
        <a href="#report">Board report</a>
        <a href="#portal">Portal mocks</a>
        <a href="#pilot">Request a pilot</a>
      </nav>
      <section id="tree" className="stack-tight" aria-labelledby="tree-title">
        <h2 id="tree-title">Repository tree</h2>
        <p className="note">
          `_control/`, `ontology/`, `core/value-flow`, `core/enable`, `core/govern`, `projects/`,
          and `comps/`. The marked file is the unit below.
        </p>
        <div className="panel">
          <RepoTree nodes={exampleTree} />
        </div>
      </section>
      <section id="unit" className="stack-tight" aria-labelledby="unit-title">
        <h2 id="unit-title">Unit</h2>
        <p className="mono">{unit.sourcePath}</p>
        <p className="note">
          Copied into this site so the certification project can build on its own. The file in the
          repository is the source. The text matches that file.
        </p>
        <dl className="meta-grid">
          {fields.map((field) => (
            <Fragment key={field.key}>
              <dt>{field.key}</dt>
              <dd className="mono">{field.value || "—"}</dd>
            </Fragment>
          ))}
        </dl>
        <MarkdownBlock source={unit.body} headingBase={3} />
        <details>
          <summary>Full source file</summary>
          <pre className="unit-raw">{unit.raw}</pre>
        </details>
      </section>
      <section id="readiness" className="stack-tight" aria-labelledby="readiness-title">
        <h2 id="readiness-title">Readiness</h2>
        <p className="note">Five axes, each from 0 to 5. The chart and the table are the same numbers.</p>
        <div className="split">
          <ReadinessRadar axes={report.readiness} />
          <table>
            <caption className="note">
              Readiness for Kilnwatch. The numbers are not an average and not a badge.
            </caption>
            <thead>
              <tr>
                <th>Axis</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {report.readiness.map((axis) => (
                <tr key={axis.axis}>
                  <th scope="row">{axis.axis}</th>
                  <td className="mono">{axis.score} / 5</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section id="report" className="stack-tight" aria-labelledby="report-heading">
        <h2 id="report-heading" className="kicker">
          One page for the sponsor
        </h2>
        <BoardReport />
      </section>
      <section id="portal" className="stack-tight" aria-labelledby="portal-title">
        <h2 id="portal-title">Two portal screens, mocked</h2>
        <p className="note">
          The learner portal is out of this prototype. These two screens show the course player
          and the credential wallet only, so a sponsor can see the shape.
        </p>
        <PortalMocks />
      </section>
      <section id="pilot">
        <DisabledForm
          id="pilot"
          title="Request a pilot"
          note="Pilot requests are not accepted in this prototype. The form is disabled. Nothing is sent."
          submitLabel="Request a pilot"
          fields={[
            { name: "organization", label: "Organization" },
            { name: "sponsor", label: "Sponsor name" },
            { name: "project", label: "Project the pause would cover" },
          ]}
        />
      </section>
      <p className="inline-links">
        <Link href="/implement/big-pause">Start at the Big Pause</Link>
        <Link href="/verify/FLX-P-1042">Mara Ellison, FLX-P-1042</Link>
      </p>
    </>
  );
}

function parseFrontmatter(frontmatter: string): { key: string; value: string }[] {
  const rows: { key: string; value: string }[] = [];
  let current: { key: string; value: string } | null = null;
  for (const line of frontmatter.split("\n")) {
    const item = /^\s+-\s+(.+)$/.exec(line);
    if (item && current) {
      current.value = current.value ? `${current.value}, ${item[1]}` : (item[1] ?? "");
      continue;
    }
    const pair = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line);
    if (pair?.[1]) {
      current = { key: pair[1], value: pair[2] ?? "" };
      rows.push(current);
    }
  }
  return rows;
}
