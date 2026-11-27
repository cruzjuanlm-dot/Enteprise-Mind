export function StatusMark({
  kind,
}: {
  kind: "active" | "expired" | "revoked" | "unknown" | "rejected";
}) {
  const label =
    kind === "active"
      ? "Active"
      : kind === "expired"
        ? "Expired"
        : kind === "revoked"
          ? "Revoked"
          : kind === "unknown"
            ? "Unknown"
            : "Rejected";
  return (
    <span className={`status-mark status-mark-${kind}`}>
      <svg aria-hidden="true" viewBox="0 0 16 16" className="status-shape">
        {kind === "active" ? <circle cx="8" cy="8" r="5" fill="currentColor" /> : null}
        {kind === "expired" ? (
          <circle cx="8" cy="8" r="5.25" fill="none" stroke="currentColor" strokeWidth="1.75" />
        ) : null}
        {kind === "revoked" ? (
          <>
            <circle cx="8" cy="8" r="5.25" fill="none" stroke="currentColor" strokeWidth="1.75" />
            <path d="M5.2 5.2 L10.8 10.8" stroke="currentColor" strokeWidth="1.75" />
          </>
        ) : null}
        {kind === "unknown" ? (
          <circle
            cx="8"
            cy="8"
            r="5.25"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeDasharray="2.2 1.8"
          />
        ) : null}
        {kind === "rejected" ? (
          <path d="M8 2.2 L14 13.2 H2 Z" fill="none" stroke="currentColor" strokeWidth="1.6" />
        ) : null}
      </svg>
      <span>{label}</span>
    </span>
  );
}
