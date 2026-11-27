---
id: units
title: Units, comps, and registers
version: "0.1"
status: Draft
---

A unit file stays in `projects/{id}/units/`. Company scope is a field on the file. The file does not move when scope changes.

Frontmatter carries the id, title, type, scope, project, source, version, status, owner, entities, and what the unit supersedes. Git history is the version log. The body states the decision or the procedure in prose.

A comp lives at `comps/{id}/COMP.md` and lists the units it contains. Each course on this site has a registry id of the same kind, `comp.{slug}`, so the catalog is not a second list the tool must be taught by hand.

Credential records are not units, and they do not live in git. The Certification Board issues them. [Verify](/verify) shows the public fields: holder, tier, issue date, expiry date, and status.

Proposed. On the Practitioner and Master practicals, the candidate builds a small fictional project. `npm run validate-units` checks structure. An examiner grades judgment.
