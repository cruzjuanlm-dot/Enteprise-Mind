-- Flux entity tables for the knowledge catalog.
--
-- Apply this file on its own, and only to a local database.
-- It does not store transcripts, payloads, or recordings. Zero retention:
-- a conversation unit lives in git as a written summary. unit_refs points at
-- that file. commit_sha stays null until a later sync pins a commit.
-- Git history of the Markdown file is the version log.
--
-- public.projects belongs to 20261108120000_core.sql (tenant pilot projects).
-- This file stores the catalog project entity as public.entity_projects so
-- core, entities, meetings, and admin_tokens apply in timestamp order.
-- core.sql is not modified here.
--
-- Source of truth for each entity type is declared in ontology/entities.
-- This migration does not copy git into the database. That sync is later.
--
-- anon and authenticated are Supabase roles. On stock Postgres they are
-- absent, so the read policy is skipped and the migration still applies.
-- When those roles exist, they receive select only. There is no write policy.

create or replace function public.flux_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.flux_touch_updated_at() from public;

create table public.person_roles (
  id text primary key,
  name text not null,
  summary text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint person_roles_name_check check (btrim(name) <> ''),
  constraint person_roles_summary_check check (btrim(summary) <> '')
);

create table public.systems (
  id text primary key,
  name text not null,
  summary text not null,
  kind text not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint systems_kind_check check (kind in ('product', 'platform', 'service')),
  constraint systems_status_check check (status in ('proposed', 'active', 'retired')),
  constraint systems_name_check check (btrim(name) <> '')
);

create table public.entity_projects (
  id text primary key,
  name text not null,
  summary text not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entity_projects_status_check check (status in ('proposed', 'active', 'closed')),
  constraint entity_projects_name_check check (btrim(name) <> '')
);

comment on table public.entity_projects is
  'Catalog project entity. Pilot rows stay in public.projects from 20261108120000_core.sql.';

create table public.environments (
  id text primary key,
  name text not null,
  summary text not null,
  system_id text not null references public.systems (id),
  stage text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint environments_stage_check check (stage in ('bench', 'studio', 'archive'))
);

create table public.data_sources (
  id text primary key,
  name text not null,
  summary text not null,
  system_id text not null references public.systems (id),
  source_kind text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint data_sources_kind_check check (source_kind in ('table', 'feed', 'file'))
);

create table public.table_schemas (
  id text primary key,
  name text not null,
  summary text not null,
  data_source_id text not null references public.data_sources (id),
  columns jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint table_schemas_columns_check check (jsonb_typeof(columns) = 'array')
);

create table public.integrations (
  id text primary key,
  name text not null,
  summary text not null,
  from_system_id text not null references public.systems (id),
  to_system_id text not null references public.systems (id),
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint integrations_status_check check (status in ('proposed', 'active', 'paused'))
);

create table public.workflows (
  id text primary key,
  name text not null,
  summary text not null,
  project_id text not null references public.entity_projects (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.requirements (
  id text primary key,
  name text not null,
  summary text not null,
  project_id text not null references public.entity_projects (id),
  statement text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint requirements_statement_check check (btrim(statement) <> '')
);

create table public.use_cases (
  id text primary key,
  name text not null,
  summary text not null,
  system_id text not null references public.systems (id),
  actor_role_id text not null references public.person_roles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.test_cases (
  id text primary key,
  name text not null,
  summary text not null,
  requirement_id text not null references public.requirements (id),
  expected text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint test_cases_expected_check check (btrim(expected) <> '')
);

create table public.milestones (
  id text primary key,
  name text not null,
  summary text not null,
  project_id text not null references public.entity_projects (id),
  target_on date not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint milestones_status_check check (status in ('planned', 'done'))
);

create table public.decisions (
  id text primary key,
  name text not null,
  summary text not null,
  project_id text not null references public.entity_projects (id),
  state text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint decisions_state_check check (state in ('proposed', 'accepted', 'superseded'))
);

create table public.entity_relationships (
  id text primary key,
  relationship_type text not null,
  from_type text not null,
  from_id text not null,
  to_type text not null,
  to_id text not null,
  created_at timestamptz not null default now(),
  constraint entity_relationships_from_type_check check (
    from_type in (
      'system', 'environment', 'data_source', 'table_schema', 'integration',
      'workflow', 'project', 'requirement', 'use_case', 'test_case',
      'milestone', 'decision', 'person_role'
    )
  ),
  constraint entity_relationships_to_type_check check (
    to_type in (
      'system', 'environment', 'data_source', 'table_schema', 'integration',
      'workflow', 'project', 'requirement', 'use_case', 'test_case',
      'milestone', 'decision', 'person_role'
    )
  ),
  constraint entity_relationships_pair_unique unique (relationship_type, from_id, to_id)
);

create table public.unit_refs (
  id text primary key,
  unit_type text not null,
  scope text not null,
  project_id text not null references public.entity_projects (id),
  source_id text not null,
  title text not null,
  version integer not null,
  status text not null,
  owner text not null,
  repo_path text not null,
  commit_sha text,
  supersedes text references public.unit_refs (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unit_refs_type_check check (
    unit_type in ('DEC', 'REQ', 'ARC', 'DS', 'BR', 'WF', 'OQ')
  ),
  constraint unit_refs_scope_check check (scope in ('project', 'company')),
  constraint unit_refs_source_id_check check (source_id ~ '^source\.[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint unit_refs_id_type_check check (
    id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*-(DEC|REQ|ARC|DS|BR|WF|OQ)-[0-9]{3}$'
    and id ~ ('-' || unit_type || '-[0-9]{3}$')
  ),
  constraint unit_refs_version_check check (version >= 1),
  constraint unit_refs_status_check check (status in ('draft', 'accepted', 'superseded')),
  constraint unit_refs_commit_sha_check check (
    commit_sha is null or commit_sha ~ '^[0-9a-f]{7,64}$'
  )
);

comment on column public.unit_refs.repo_path is
  'Path of the unit markdown file. The file body is not copied here. Company scope does not change the path.';

comment on column public.unit_refs.commit_sha is
  'Optional pin recorded by a later sync. Null means git history is still the only version log.';

create table public.unit_ref_entities (
  unit_id text not null references public.unit_refs (id) on delete cascade,
  entity_id text not null,
  primary key (unit_id, entity_id)
);

create index environments_system_id_idx on public.environments (system_id);
create index data_sources_system_id_idx on public.data_sources (system_id);
create index table_schemas_data_source_id_idx on public.table_schemas (data_source_id);
create index integrations_from_system_id_idx on public.integrations (from_system_id);
create index integrations_to_system_id_idx on public.integrations (to_system_id);
create index workflows_project_id_idx on public.workflows (project_id);
create index requirements_project_id_idx on public.requirements (project_id);
create index use_cases_system_id_idx on public.use_cases (system_id);
create index use_cases_actor_role_id_idx on public.use_cases (actor_role_id);
create index test_cases_requirement_id_idx on public.test_cases (requirement_id);
create index milestones_project_id_idx on public.milestones (project_id);
create index decisions_project_id_idx on public.decisions (project_id);
create index entity_relationships_from_idx on public.entity_relationships (from_type, from_id);
create index entity_relationships_to_idx on public.entity_relationships (to_type, to_id);
create index unit_refs_project_id_idx on public.unit_refs (project_id);
create index unit_refs_unit_type_idx on public.unit_refs (unit_type);
create index unit_ref_entities_entity_id_idx on public.unit_ref_entities (entity_id);

create trigger person_roles_touch_updated_at
  before update on public.person_roles
  for each row execute function public.flux_touch_updated_at();

create trigger systems_touch_updated_at
  before update on public.systems
  for each row execute function public.flux_touch_updated_at();

create trigger entity_projects_touch_updated_at
  before update on public.entity_projects
  for each row execute function public.flux_touch_updated_at();

create trigger environments_touch_updated_at
  before update on public.environments
  for each row execute function public.flux_touch_updated_at();

create trigger data_sources_touch_updated_at
  before update on public.data_sources
  for each row execute function public.flux_touch_updated_at();

create trigger table_schemas_touch_updated_at
  before update on public.table_schemas
  for each row execute function public.flux_touch_updated_at();

create trigger integrations_touch_updated_at
  before update on public.integrations
  for each row execute function public.flux_touch_updated_at();

create trigger workflows_touch_updated_at
  before update on public.workflows
  for each row execute function public.flux_touch_updated_at();

create trigger requirements_touch_updated_at
  before update on public.requirements
  for each row execute function public.flux_touch_updated_at();

create trigger use_cases_touch_updated_at
  before update on public.use_cases
  for each row execute function public.flux_touch_updated_at();

create trigger test_cases_touch_updated_at
  before update on public.test_cases
  for each row execute function public.flux_touch_updated_at();

create trigger milestones_touch_updated_at
  before update on public.milestones
  for each row execute function public.flux_touch_updated_at();

create trigger decisions_touch_updated_at
  before update on public.decisions
  for each row execute function public.flux_touch_updated_at();

create trigger unit_refs_touch_updated_at
  before update on public.unit_refs
  for each row execute function public.flux_touch_updated_at();

do $lockdown$
declare
  rel text;
begin
  foreach rel in array array[
    'person_roles',
    'systems',
    'entity_projects',
    'environments',
    'data_sources',
    'table_schemas',
    'integrations',
    'workflows',
    'requirements',
    'use_cases',
    'test_cases',
    'milestones',
    'decisions',
    'entity_relationships',
    'unit_refs',
    'unit_ref_entities'
  ]
  loop
    execute format('alter table public.%I enable row level security', rel);
    execute format('revoke all on table public.%I from public', rel);
  end loop;
end
$lockdown$;

do $catalog_read$
declare
  rel text;
begin
  if not (
    exists (select 1 from pg_roles where rolname = 'anon')
    and exists (select 1 from pg_roles where rolname = 'authenticated')
  ) then
    raise notice 'catalog read grants skipped; anon and authenticated are absent';
    return;
  end if;

  revoke all on function public.flux_touch_updated_at() from anon, authenticated;

  foreach rel in array array[
    'person_roles',
    'systems',
    'entity_projects',
    'environments',
    'data_sources',
    'table_schemas',
    'integrations',
    'workflows',
    'requirements',
    'use_cases',
    'test_cases',
    'milestones',
    'decisions',
    'entity_relationships',
    'unit_refs',
    'unit_ref_entities'
  ]
  loop
    execute format('revoke all on table public.%I from anon, authenticated', rel);
    execute format('grant select on table public.%I to anon, authenticated', rel);
    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (true)',
      rel || '_read',
      rel
    );
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format(
        'grant select, insert, update, delete on table public.%I to service_role',
        rel
      );
    end if;
  end loop;
end
$catalog_read$;
