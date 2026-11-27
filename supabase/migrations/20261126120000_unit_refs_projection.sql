-- Projection columns for company-scoped units.
-- Run after 20261125120000_admin_tokens.sql on a database that already has unit_refs.
-- Renames repo_path to unit_path and adds domain. Does not edit earlier migrations.
-- Does not drop transcripts or public.transcripts.

alter table public.unit_refs rename column repo_path to unit_path;

comment on column public.unit_refs.unit_path is
  'Path of the unit markdown file. The file stays put when scope becomes company.';

alter table public.unit_refs
  add column domain text,
  add column sub_type text,
  add column meeting text,
  add column meeting_date date,
  add column systems_touched text[] not null default '{}',
  add column acceptance_criteria text;

alter table public.unit_refs
  add constraint unit_refs_domain_check check (
    domain is null or domain in ('market', 'acquire', 'deliver', 'retain', 'enable', 'govern')
  ),
  add constraint unit_refs_company_domain_check check (
    scope <> 'company' or domain is not null
  ),
  add constraint unit_refs_req_acceptance_check check (
    unit_type <> 'REQ' or (acceptance_criteria is not null and btrim(acceptance_criteria) <> '')
  ),
  add constraint unit_refs_meeting_check check (
    meeting is null or meeting ~ '^meeting\.[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  add constraint unit_refs_sub_type_check check (
    sub_type is null or btrim(sub_type) <> ''
  );

comment on column public.unit_refs.domain is
  'Value-stream route for a company-scoped unit. Null while scope is project. The file does not move.';

comment on column public.unit_refs.commit_sha is
  'Commit that last changed the unit file. Null until the pin job records it.';

create index unit_refs_domain_idx on public.unit_refs (domain);
