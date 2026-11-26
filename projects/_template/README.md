# Project template

Copy this directory to `projects/{slug}/` when a catalog project opens. `{slug}` is the project entity id without the `project.` prefix.

Put one knowledge unit in `units/{ProjectID}-{SourceIDShort}-{TypeCode}-{Seq}.md`.

Type codes are `DEC`, `REQ`, `ARC`, `DS`, `BR`, and `WF`, plus `OQ` for an open question or an unresolved source summary.

Set `scope` to `project` or `company` in frontmatter. Do not move the file when the scope becomes `company`.

Do not leave a sample unit in this folder. The validator skips `_template`.
