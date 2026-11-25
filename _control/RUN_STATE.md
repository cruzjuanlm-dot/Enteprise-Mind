# Run state

The repository uses the architectural synthesis layout.

- Knowledge units live in `projects/{id}/units/`, one concept per file.
- Company scope is a frontmatter tag. Files stay where they were written.
- Meeting extraction discards transcript text. Unresolved claims go to `triage.md`.
- `LLM_ENABLED` stays off. Meeting extraction does not call a model.
