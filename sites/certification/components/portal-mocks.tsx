import { formatUtcDate } from "@/lib/dates";
import { getCourse } from "@/lib/catalog";
import { lookupCredential } from "@/lib/verify";

export function PortalMocks() {
  const course = getCourse("foundations");
  const wallet = lookupCredential("FLX-P-1042", new Date("2026-11-26T00:00:00Z"));
  const moduleName = course?.modules[1] ?? "Frontmatter, type, and scope";
  return (
    <div className="split">
      <figure className="panel mock">
        <figcaption>Mock screen. The learner portal is not in this prototype.</figcaption>
        <div className="mock-chrome">
          <p className="kicker">Course player</p>
          <h3>{course?.title ?? "Foundations"}</h3>
          <p className="note">Module 2 of {course?.modules.length ?? 5}. {moduleName}.</p>
          <p>
            A unit file keeps one decision. The frontmatter names the type, the owner, and the
            scope. The body says what was decided. The file stays in the project directory.
          </p>
          <button type="button" className="button" disabled>
            Next module
          </button>
        </div>
      </figure>
      <figure className="panel mock">
        <figcaption>Mock screen. The credential wallet is not in this prototype.</figcaption>
        <div className="mock-chrome">
          <p className="kicker">Credential wallet</p>
          {wallet.kind === "found" ? (
            <>
              <h3 className="mock-id">{wallet.credential.id}</h3>
              <p>
                {wallet.credential.holder}. {wallet.tierName}. Active.
              </p>
              <p className="note">
                Issued {formatUtcDate(wallet.credential.issued)}. Expires{" "}
                {formatUtcDate(wallet.credential.expires)}.
              </p>
            </>
          ) : null}
          <h3>Renewal log</h3>
          <p className="state state-empty">No renewal is recorded.</p>
        </div>
      </figure>
    </div>
  );
}
