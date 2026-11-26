# Enterprise Mind

Pilot slice for turning a transcript into proposed decisions and tasks, then accepting or rejecting them before they become shared context. The interface follows [DESIGN.md](DESIGN.md).

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

Apply `supabase/migrations/20261108120000_core.sql` to the Supabase project, then `supabase/seed.sql` for the fictional Hearthline Instruments tenant, Field Systems department, and Sensor firmware review project. After a real user exists in Supabase Auth, insert a `tenant_memberships` row and, unless the role is admin, a `project_memberships` row. The seed file shows the columns. Do not put keys or passwords in that file.

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
| `RECALL_API_KEY` | Required to send a meeting bot. Server only |
| `RECALL_REGION` | Required with the API key. Region slug for the Recall origin |
| `RECALL_WORKSPACE_SECRET` | Required to accept Recall webhooks. `whsec_` prefix |
| `RECALL_DOWNLOAD_HOSTS` | Required to download a transcript. Comma-separated HTTPS hosts |
| `FLUX_SUBSCRIPTION_ACTIVE` | Required to send a bot. `true` or the request is rejected. Stripe is not connected |
| `FLUX_BOTS_AUTH_SECRET` | Required on `POST /api/bots` for the internal caller. Callers send `Authorization: Bearer` |
| `FLUX_TOKEN_PEPPER` | Required to create or verify a personal `flux_` token. Server only. HMAC key |
| `FLUX_ADMIN_SECRET` | Required for `/admin`. Missing secret fails closed |
| `GITHUB_TOKEN` or `FLUX_GITHUB_TOKEN` | Optional. Opens a draft pull request for meeting notes |
| `LLM_ENABLED` | Leave empty or `false`. Meeting extraction does not call a model |

The service role bypasses row level security. Application pages and review actions use the signed-in user session. The meeting bot uses the service role only when Supabase mode is on, and only on the server, because meeting tables are select-only for anonymous and signed-in users. Do not expose the service role key to the browser. A missing required variable fails closed.

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

Admins see the tenant. Reviewers see assigned projects, source transcripts for those projects, and proposed units. Members see accepted units on assigned projects. Department pages only list projects the user can access. A second seeded project, Calibration vault, is intentionally hidden from the reviewer fixture.

## Knowledge catalog

A second slice stores governed writing in git and entity rows for a fictional company, Hearthline Instruments. The repository name, the Vercel project, and the Enterprise Mind title are unchanged.

- `INDEX.md` is routing only. `npm run build-unit-index` regenerates it and the gitignored ledger `_control/ledgers/unit-index.json`.
- `ontology/entities/*.schema.json` declares each entity type, its `x-source-of-truth` (`git`, `db`, or `both`), and the one-way `x-mirror-direction` a later sync would use. That sync is not built.
- `ontology/schemas/` holds the unit and composition schemas. `ontology/relationships.yaml` lists the legal edges. Instance rows live in `ontology/seed/`.
- `projects/{id}/units/{ProjectID}-{SourceIDShort}-{TypeCode}-{Seq}.md` is one knowledge unit. Type codes are `DEC`, `REQ`, `ARC`, `DS`, `BR`, `WF`, and `OQ`. `scope` is `project` or `company`. A company tag does not move the file. Git history is the version log.
- `core/value-flow/{market,acquire,deliver,retain}`, `core/enable`, and `core/govern` describe company-scope routes. They do not hold unit files.
- `_control/` holds run state, triage, ledgers, change logs, and id migrations.
- `comps/<id>/COMP.md` groups units for one reading.
- `npm run validate-units` checks frontmatter, the type code in the id, scope, supersedes, one unit per file, entity ids, and a name denylist. GitHub Actions runs the same command.
- `/catalog` and `/catalog/[id]` are static pages. `/entities` reads Supabase when `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set, and otherwise renders the seed JSON.
- Apply local migrations in timestamp order: `20261108120000_core.sql`, `20261123120000_entities.sql`, `20261124120000_meetings.sql`, then `20261125120000_admin_tokens.sql`. `public.projects` is the pilot table. Catalog projects live in `public.entity_projects`. Do not apply these files to a hosted project.

`20261108120000_core.sql` still creates `public.transcripts` and, when Storage exists, a private `transcript-payloads` bucket. That contradicts zero retention. Those objects are unchanged here.

`supabase/migrations/20261124120000_meetings.sql` adds meetings, bots, hash-only meeting artifacts, and action items. `calendar_event_id` is reserved for a later calendar slice and is null here. Apply the chain locally, then `supabase/seed.sql`, `supabase/seed_entities.sql`, and `supabase/seed_meetings.sql`. Do not apply it to a hosted project.

## Meeting bot

`POST /api/bots` sends a Recall Create Bot request. An internal caller sends `Authorization: Bearer` with `FLUX_BOTS_AUTH_SECRET`. A subscriber token that starts with `flux_` is also accepted when it includes the `meetings:write` scope. The server calls Recall with `Authorization: Token` and `RECALL_API_KEY`. A meeting more than 10 minutes away is scheduled with `join_at`. A sooner meeting is ad-hoc. An HTTP 507 waits about 30 seconds and tries once more. Transcription uses Recall's built-in `recallai_streaming` provider. A missing key returns 503. An inactive `FLUX_SUBSCRIPTION_ACTIVE` flag returns 403. Stripe is not called.

Recall posts lifecycle events to `/api/webhooks/recall`. The route checks the raw body with HMAC-SHA256 over `id.timestamp.rawBody`, accepts `webhook-*` and `svix-*` headers, and rejects timestamps outside five minutes. It returns 200 before it fetches anything. It does not poll bot status.

On `transcript.done` the job reads `GET /api/v1/transcript/{id}/` from the regional origin, downloads `data.download_url` only when the host is listed in `RECALL_DOWNLOAD_HOSTS`, and runs the rule-based extractor. It writes one source-summary unit and one decision unit per decision under `projects/{id}/units/`. A claim that does not become a unit is appended to `_control/triage.md` without transcript text. It then discards the transcript. The artifact row keeps a sha256, a segment count, speaker labels, and pointers. The same transcript hash does not write a second set of units.

When `GITHUB_TOKEN` or `FLUX_GITHUB_TOKEN` is set (and `GITHUB_REPOSITORY` or a GitHub origin remote identifies the repo), those units open a draft pull request. Otherwise they are written to the working tree.

Subscribe the webhook to `bot.joining_call`, `bot.in_waiting_room`, `bot.in_call_not_recording`, `bot.recording_permission_allowed`, `bot.recording_permission_denied`, `bot.in_call_recording`, `bot.call_ended`, `bot.done`, `bot.fatal`, `recording.done`, `transcript.done`, and `transcript.failed`. This repository does not register that webhook.

## Admin, tokens, and MCP

`/admin` lists the fictional Hearthline Instruments workspace, its subscribers, the subscription stub, meeting bots, and API token metadata. The page checks `FLUX_ADMIN_SECRET` on the server. If that variable is missing, the page lists nothing. A signed-in pilot user is not enough.

`supabase/migrations/20261125120000_admin_tokens.sql` comes after the meetings migration. It adds workspaces, subscribers, admin roles, `api_tokens`, and `audit_log`. Apply it locally as the fourth migration, then apply `supabase/seed_admin.sql` after the meeting seed. Do not apply it to a hosted project.

A personal token looks like `flux_` plus 32 bytes of base64url. Creating one returns that string once. The database stores `HMAC-SHA256(FLUX_TOKEN_PEPPER, token)` as hex, plus the prefix, the last four characters, scopes, expiry, revocation, and `last_used_at`. The hash is not readable by the `anon` or `authenticated` roles. Owners can select their own metadata.

| Scope | Allows |
| --- | --- |
| `units:read` | `search_units`, `get_unit` |
| `entities:read` | `list_entities` |
| `action_items:read` | `list_action_items` |
| `meetings:write` | `send_meeting_bot` and `POST /api/bots` |

Signed-in Hearthline subscribers create, list, and revoke their own tokens at `/tokens`. `POST /api/tokens` returns the plaintext once. Revoked and expired tokens are rejected. A token without the required scope is rejected. Comparisons use a timing-safe equality check. Each accepted token has a per-token rate-limit stub.

`FLUX_BOTS_AUTH_SECRET` is still the internal shared secret for `POST /api/bots`. It is not a subscriber token and it has no scopes. Subscriber tokens do not replace it. Both callers still need `FLUX_SUBSCRIPTION_ACTIVE`.

`/api/mcp` is a remote MCP server over Streamable HTTP. It uses the same `flux_` tokens. Read tools do not write. `send_meeting_bot` requires `meetings:write`. Add Flux to an MCP client with a placeholder token:

```json
{
  "mcpServers": {
    "flux": {
      "url": "https://YOUR_DEPLOYMENT/api/mcp",
      "headers": {
        "Authorization": "Bearer flux_YOUR_TOKEN"
      }
    }
  }
}
```

The client must accept both `application/json` and `text/event-stream`. Claude Desktop and Cursor use the same URL and bearer header for a remote MCP server. The token is created in Enterprise Mind. Do not paste a real token into git.

## Not in this slice

Connector catalog, SSO, glossary browsing, graph pages, execution, approval gates for side effects, unattended work, Calendar V2 auto-join, Stripe billing, and model-backed meeting extraction.
