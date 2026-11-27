"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type DirectoryRow = {
  id: string;
  name: string;
  tierName: string;
  organization: string;
  practice: string;
  listing: string;
  credentialId: string | null;
};

export function DirectoryList({ entries }: { entries: DirectoryRow[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return entries;
    return entries.filter((entry) =>
      [entry.name, entry.tierName, entry.organization, entry.practice, entry.listing]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [entries, query]);

  if (entries.length === 0) {
    return (
      <div className="state state-empty">
        <h2>Nobody has opted in</h2>
        <p>The directory is empty. Verify can still look up a credential id.</p>
      </div>
    );
  }

  return (
    <div className="stack">
      <form role="search" className="field" onSubmit={(event) => event.preventDefault()}>
        <label htmlFor="directory-filter">Filter by name, tier, or organization</label>
        <input
          id="directory-filter"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </form>
      {filtered.length === 0 ? (
        <div className="state state-empty">
          <h2>No match</h2>
          <p>No opted-in person matches that filter.</p>
        </div>
      ) : (
        <ul className="index-list">
          {filtered.map((entry) => (
            <li key={entry.id}>
              <h2 className="row-title">{entry.name}</h2>
              <p className="row-summary">
                {entry.listing}. {entry.organization}. {entry.practice}.
              </p>
              <p className="row-meta">{entry.tierName}</p>
              {entry.credentialId ? (
                <Link className="text-target" href={`/verify/${entry.credentialId}`}>
                  <span className="mono">{entry.credentialId}</span>
                </Link>
              ) : (
                <p className="note">Public id is not in this prototype sample.</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
