import Link from "next/link";
import { checkCredential } from "@/app/verify/actions";
import { CheckButton } from "@/components/check-button";
import { PageHeader } from "@/components/page-header";
import { formatUtcDate } from "@/lib/dates";
import type { VerifyView } from "@/lib/verify";

const issued = [
  { href: "/verify/FLX-P-1042", id: "FLX-P-1042", label: "Active" },
  { href: "/verify/FLX-S-1007", id: "FLX-S-1007", label: "Expired" },
  { href: "/verify/FLX-T-1019", id: "FLX-T-1019", label: "Revoked" },
];

const other = [
  { href: "/verify/FLX-P-0000", id: "FLX-P-0000", label: "Unknown id" },
  { href: "/verify/NOT-AN-ID", id: "NOT-AN-ID", label: "Rejected text" },
];

export function VerifyScreen({ result }: { result: VerifyView }) {
  const initialId = result.kind === "empty" ? "" : result.kind === "found" ? result.credential.id : result.id;
  return (
    <>
      <PageHeader
        kicker="Verify"
        title={titleFor(result)}
        lede={ledeFor(result)}
        monoTitle={result.kind === "found"}
      />
      <form key={initialId || "empty"} className="form" action={checkCredential}>
        <div className="field">
          <label htmlFor="credential-id">Credential id</label>
          <div className="lookup-row">
            <input
              id="credential-id"
              name="id"
              className="input-mono"
              defaultValue={initialId}
              autoComplete="off"
              spellCheck={false}
              maxLength={64}
              aria-describedby="id-hint"
            />
            <CheckButton />
          </div>
          <p id="id-hint" className="note">
            Form FLX, one letter, four digits. Example: FLX-P-1042.
          </p>
        </div>
      </form>
      <div aria-live="polite">{resultBody(result)}</div>
      <section className="stack-tight" aria-labelledby="samples-title">
        <h2 id="samples-title">Sample lookups</h2>
        <p className="note">Three fictional credentials, plus an unknown id and a rejected string.</p>
        <ul className="sample-list">
          {issued.map((item) => (
            <li key={item.id}>
              <Link href={item.href}>
                <span className="mono">{item.id}</span>
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
        <ul className="sample-list">
          {other.map((item) => (
            <li key={item.id}>
              <Link href={item.href}>
                <span className="mono">{item.id}</span>
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <p className="inline-links">
        <Link href="/certification">Tiers and blueprints</Link>
        <Link href="/directory">Directory of people who opted in</Link>
      </p>
    </>
  );
}

function titleFor(result: VerifyView): string {
  if (result.kind === "empty") return "Verify a credential";
  if (result.kind === "error") return "This id cannot be looked up";
  if (result.kind === "unknown") return "No credential for this id";
  return result.credential.id;
}

function ledeFor(result: VerifyView): string {
  if (result.kind === "empty") {
    return "Public lookup. The record shows a name or initials, the tier, the issue date, the expiry date, and the status.";
  }
  if (result.kind === "error") {
    return "The register only accepts an id shaped like FLX-P-1042.";
  }
  if (result.kind === "unknown") {
    return "The id is well formed. It is not one of the three fictional credentials in this prototype.";
  }
  if (result.displayStatus === "active") {
    return "This mark is current. Expiry and status are both on the record.";
  }
  if (result.displayStatus === "expired") {
    return "This mark is expired. It stays on the public record, and it is not current.";
  }
  return "This mark is revoked. It stays on the public record, and it is not current.";
}

function resultBody(result: VerifyView) {
  if (result.kind === "empty") {
    return (
      <div className="state state-empty">
        <h2>Nothing looked up yet</h2>
        <p>Enter an id, or open one of the sample lookups. An empty field does not search.</p>
      </div>
    );
  }
  if (result.kind === "error") {
    return (
      <div className="state state-error" role="alert">
        <h2>Rejected</h2>
        <p>
          <span className="mono">{clip(result.id)}</span> is not an id this register can check.
        </p>
      </div>
    );
  }
  if (result.kind === "unknown") {
    return (
      <div className="state state-unknown">
        <h2>Unknown</h2>
        <p>
          No credential is filed under <span className="mono">{result.id}</span>.
        </p>
      </div>
    );
  }
  const { credential, displayStatus, tierName, tierSlug } = result;
  const tone =
    displayStatus === "active" ? "state-active" : displayStatus === "expired" ? "state-expired" : "state-revoked";
  const statusWord =
    displayStatus === "active" ? "Active" : displayStatus === "expired" ? "Expired" : "Revoked";
  return (
    <div className={`state ${tone}`}>
      <h2>{statusWord}</h2>
      <dl className="meta-grid">
        <dt>Holder</dt>
        <dd>{credential.holder}</dd>
        <dt>Tier</dt>
        <dd>{tierName ?? "Not in the catalog"}</dd>
        <dt>Issued</dt>
        <dd>{formatUtcDate(credential.issued)}</dd>
        <dt>Expires</dt>
        <dd>{formatUtcDate(credential.expires)}</dd>
        <dt>Status</dt>
        <dd>{statusWord}</dd>
      </dl>
      {displayStatus === "expired" ? (
        <p>The term ended on {formatUtcDate(credential.expires)}. Renewal is not automatic.</p>
      ) : null}
      {displayStatus === "revoked" ? (
        <p>
          Revocation is separate from expiry. The expiry date remains so the original term can be
          seen. This sample does not store a separate revocation date.
        </p>
      ) : null}
      {tierSlug && tierName ? (
        <p>
          <Link href={`/certification/${tierSlug}`}>Assessment blueprint for {tierName}</Link>
        </p>
      ) : (
        <p role="alert">This credential names a tier the catalog does not have.</p>
      )}
    </div>
  );
}

function clip(id: string): string {
  return id.length > 64 ? `${id.slice(0, 64)}…` : id;
}
