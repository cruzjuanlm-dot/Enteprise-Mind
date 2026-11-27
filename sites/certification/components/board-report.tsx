import { Fragment } from "react";
import { formatUtcStamp } from "@/lib/dates";
import { getHearthlineReport } from "@/lib/hearthline";

export function BoardReport() {
  const report = getHearthlineReport();
  return (
    <article className="panel stack-tight" aria-labelledby="board-report-title">
      <p className="kicker">Fictional sample · same fields the Flux tool reports</p>
      <h2 id="board-report-title">Board report</h2>
      <p>
        {report.organization}, {report.department}. {report.project}{" "}
        <span className="mono">{report.projectId}</span>. As of {formatUtcStamp(report.asOf)}.
      </p>
      <dl className="metric-list">
        <dt>Sessions held</dt>
        <dd>{report.sessionsHeld}</dd>
        <dt>Asset register</dt>
        <dd>{report.assetRegisterRows} rows</dd>
        <dt>Debt register</dt>
        <dd>{report.debtRegisterRows} rows</dd>
        <dt>Certified people</dt>
        <dd>{report.certifiedPeople}</dd>
        <dt>Velocity</dt>
        <dd>{report.velocityDays} days</dd>
      </dl>
      <h3>Readiness</h3>
      <dl className="metric-list">
        {report.readiness.map((axis) => (
          <Fragment key={axis.axis}>
            <dt>{axis.axis}</dt>
            <dd>{axis.score} / 5</dd>
          </Fragment>
        ))}
      </dl>
      <ul className="plain-list">
        <li>{report.notes.sessions}</li>
        <li>{report.notes.assets}</li>
        <li>{report.notes.debt}</li>
        <li>{report.notes.certified}</li>
        <li>{report.notes.velocity}</li>
      </ul>
    </article>
  );
}
