# Enterprise Mind

Pilot slice for turning a transcript into proposed decisions and tasks, then accepting or rejecting them before they are trusted.

This is the first build from the draft v0.2 PRD. It does not include the connector catalog, SSO, or unattended execution.

## What this slice does

- Stores tenants, departments, projects, transcripts, knowledge units, job status, and review events in Supabase Postgres.
- Keeps every row tenant-scoped. Projects belong to one department. A transcript can be unassigned, filed on a project, marked cross-functional, or filed as non-project.
- Requires an authenticated user for application data. Row level security is enabled on the core tables. Reviewers accept or reject proposed units. Members see accepted units for projects they belong to, not proposed ones and not other projects.
- Accepts transcripts through `POST /api/ingest`. The route stores the original payload, writes a transcript row, and enqueues extraction. It is not a client-side storage upload.
- Runs extraction after the response. With no model key, a deterministic extractor reads labeled blocks and leaves missing owners, dependencies, systems, acceptance criteria, due dates, and approval requirements as unknown.
- Shows a review queue, job status, and minimal department and project pages.

## Local development

Install and run:

```bash
npm install
npm test
npm run dev
```

If the Supabase variables are empty, the app uses an in-memory stand-in and a local sign-in screen. That stand-in is for development only. It is refused when `VERCEL_ENV=production`.

The local sign-in fixtures are `reviewer@local.test`, `member@local.test`, `admin@local.test`, and `outsider@local.test`. They are not accounts and they disappear when Supabase Auth is configured.

Apply `supabase/migrations/20261108120000_core.sql` to the Supabase project, then `supabase/seed.sql` for the pilot tenant, department, and project. After a real user exists in Supabase Auth, insert a `tenant_memberships` row and, unless the role is admin, a `project_memberships` row. The seed file shows the columns. Do not put keys or passwords in that file.

Create a private Storage bucket named `transcript-payloads` if the migration did not create it. The service role writes payloads. Ordinary users do not get a storage policy.

## Environment

Copy `.env.example` and set values only in a local untracked env file or in the host's secret store.

| Name | Required |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | For Supabase mode |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | For Supabase mode |
| `SUPABASE_SERVICE_ROLE_KEY` | For Supabase mode, backend jobs only |
| `EXTRACTION_MODEL_API_KEY` | Optional. Unset uses the deterministic extractor |
| `EXTRACTION_MODEL_BASE_URL` | Required only when a model key is set. OpenAI-compatible `/chat/completions` base |
| `EXTRACTION_MODEL` | Optional model name |
| `ENTERPRISE_MIND_DATA_MODE` | Optional `memory` or `supabase` |

The service role bypasses row level security. Application pages and review actions use the signed-in user session. Do not expose the service role key to the browser.

## Ingest

`POST /api/ingest` accepts JSON:

```json
{
  "title": "Weekly design review",
  "projectId": "44444444-4444-4444-8444-444444444444",
  "sourceSystem": "upload",
  "sourceExternalId": "meeting-1",
  "format": "text",
  "content": "Decision: Record an owner on every task\nOwner: Project lead\n"
}
```

`format` may be `text`, `vtt`, or `json`. JSON content uses `{ "turns": [{ "speaker": "Avery", "text": "..." }] }`. The same source system and external id is idempotent. Send `rerun: true` to extract again without creating a second transcript. Accepted units with the same type and title are not published twice.

Labeled blocks start with `Decision:`, `Task:`, `Architecture:`, `Risk:`, `Open question:`, or `Term:`. Optional lines are `Owner`, `Dependencies`, `Systems`, `Acceptance`, `Due`, `Approval`, and `Details`. `Due` must be `YYYY-MM-DD`. Anything not stated is stored as unknown.

Job status moves through `received`, `stored`, `extracting`, and `ready_for_review`, or `failed` with a reason code. Retry a failed extraction from the jobs page.

## Access

Admins see the tenant. Reviewers see assigned projects, source transcripts for those projects, and proposed units. Members see accepted units on assigned projects. Department pages only list projects the user can access. A second seeded project, Restricted project, is intentionally hidden from the reviewer fixture.

## Not in this slice

Connector catalog, SSO, glossary browsing, graph pages, execution, approval gates for side effects, and unattended work.
