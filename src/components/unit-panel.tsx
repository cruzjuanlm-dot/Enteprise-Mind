import type { ReactNode } from "react";
import type { FieldPresence, ReviewState, UnitType } from "@/lib/domain";
import { executionFieldsReady } from "@/lib/domain";
import { formatWhen, knownApproval, knownList, knownText, reviewLabel, reviewTone, UNIT_LABEL } from "@/lib/present";

export type ShownUnit = {
  id?: string;
  unitType: UnitType;
  title: string;
  body: string;
  sourceExcerpt: string | null;
  reviewState?: ReviewState;
  transcriptTitle?: string | null;
  extractedAt?: string | null;
  reviewedAt?: string | null;
  ownerName: string | null;
  ownerPresence: FieldPresence;
  dependencies: string[];
  dependenciesPresence: FieldPresence;
  systemsTouched: string[];
  systemsPresence: FieldPresence;
  acceptanceCriteria: string | null;
  acceptancePresence: FieldPresence;
  dueDate: string | null;
  duePresence: FieldPresence;
  approvalRequired: boolean | null;
  approvalPresence: FieldPresence;
};

export function UnitPanel({
  unit,
  projectName,
  preview = false,
  actions,
}: {
  unit: ShownUnit;
  projectName: string | null;
  preview?: boolean;
  actions?: ReactNode;
}) {
  const executable = unit.unitType === "design_decision" || unit.unitType === "pending_task";
  const ready = executionFieldsReady(unit);
  const state = unit.reviewState ?? "proposed";
  return (
    <article className="detail">
      <div className="panel">
        <div className="cluster">
          <span className="status" data-tone={preview ? "neutral" : reviewTone(state)}>
            {preview ? "Fixture preview" : reviewLabel(state)}
          </span>
          <span className="meta">{UNIT_LABEL[unit.unitType]}</span>
          <span className="meta">{projectName ?? "Unassigned"}</span>
        </div>
        <h2 className="follow">{unit.title}</h2>
        <h3 className="label">Extracted statement</h3>
        <p>{unit.body}</p>
        <dl className="fields">
          <Field label="Owner" value={knownText(unit.ownerPresence, unit.ownerName)} unknown={unit.ownerPresence === "unknown"} />
          <Field
            label="Dependencies"
            value={knownList(unit.dependenciesPresence, unit.dependencies)}
            unknown={unit.dependenciesPresence === "unknown"}
          />
          <Field
            label="Systems"
            value={knownList(unit.systemsPresence, unit.systemsTouched)}
            unknown={unit.systemsPresence === "unknown"}
          />
          <Field
            label="Acceptance"
            value={knownText(unit.acceptancePresence, unit.acceptanceCriteria)}
            unknown={unit.acceptancePresence === "unknown"}
          />
          <Field label="Due" value={knownText(unit.duePresence, unit.dueDate)} unknown={unit.duePresence === "unknown"} />
          <Field
            label="Approval"
            value={knownApproval(unit.approvalPresence, unit.approvalRequired)}
            unknown={unit.approvalPresence === "unknown"}
          />
        </dl>
        {executable ? (
          <p className="note" data-tone={ready ? "info" : "warning"}>
            {ready
              ? "Owner, dependencies, systems, acceptance, due date, and approval are stated. Accepting does not execute the task."
              : "Some execution fields are unknown. They were left unknown. Accepting does not execute the task."}
          </p>
        ) : (
          <p className="note" data-tone="info">
            This is shared vocabulary or context. It is not an executable task.
          </p>
        )}
        <p className="meta follow">Confidence: not assessed.</p>
        {unit.id ? <p className="meta mono">{unit.id}</p> : null}
        {actions ? <div className="actions">{actions}</div> : null}
      </div>
      <aside className="rail" aria-label="Source evidence">
        <h2>Source evidence</h2>
        <h3 className="label">Quoted passage</h3>
        {unit.sourceExcerpt ? (
          <blockquote className="quote">{unit.sourceExcerpt}</blockquote>
        ) : (
          <p>No quotation was stored for this unit.</p>
        )}
        <p className="meta follow">
          {preview
            ? "Synthetic fixture. Nothing is stored until someone submits the transcript."
            : unit.transcriptTitle
              ? `Transcript: ${unit.transcriptTitle}`
              : "Transcript title unavailable."}
        </p>
        <p className="help follow">
          The quotation is the source. The statement beside it is the extraction. Unknown means the passage did not say.
        </p>
        {unit.extractedAt ? (
          <p className="meta follow">
            Extracted <time dateTime={unit.extractedAt}>{formatWhen(unit.extractedAt)}</time>
          </p>
        ) : null}
        {unit.reviewedAt ? (
          <p className="meta">
            Reviewed <time dateTime={unit.reviewedAt}>{formatWhen(unit.reviewedAt)}</time>
          </p>
        ) : null}
      </aside>
    </article>
  );
}

function Field({ label, value, unknown }: { label: string; value: string; unknown: boolean }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{unknown ? "Unknown" : value}</dd>
    </div>
  );
}
