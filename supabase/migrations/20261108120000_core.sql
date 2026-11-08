-- Enterprise Mind pilot slice.
-- Tenant-scoped tables, row level security, and review transitions.
-- Service role bypasses RLS and is the only writer for ingest and extraction.
-- Authenticated users read through the policies below and may only accept or reject a proposed unit.

create extension if not exists pgcrypto;

create type public.tenant_role as enum ('admin', 'reviewer', 'approver', 'member');
create type public.filing_kind as enum ('unassigned', 'project', 'cross_functional', 'non_project');
create type public.transcript_status as enum ('stored', 'quarantined');
create type public.job_kind as enum ('ingest', 'extraction', 'execution');
create type public.job_status as enum (
  'received',
  'stored',
  'extracting',
  'ready_for_review',
  'awaiting_approval',
  'executing',
  'rolled_back',
  'failed'
);
create type public.unit_type as enum (
  'architecture',
  'design_decision',
  'pending_task',
  'risk',
  'open_question',
  'glossary_term'
);
create type public.review_state as enum ('proposed', 'accepted', 'edited', 'rejected', 'merged');
create type public.review_action as enum ('accept', 'reject', 'edit', 'merge');
create type public.field_presence as enum ('known', 'unknown');

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table public.tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.tenant_role not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, name),
  unique (id, tenant_id)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  department_id uuid not null,
  name text not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, name),
  unique (id, tenant_id),
  foreign key (department_id, tenant_id) references public.departments (id, tenant_id) on delete cascade
);

create table public.project_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  project_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  can_read_transcripts boolean not null default false,
  created_at timestamptz not null default now(),
  unique (project_id, user_id),
  foreign key (project_id, tenant_id) references public.projects (id, tenant_id) on delete cascade
);

create table public.transcripts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  project_id uuid,
  department_id uuid,
  filing_kind public.filing_kind not null default 'unassigned',
  source_system text not null,
  source_external_id text,
  title text,
  language text,
  captured_at timestamptz,
  normalized_text text not null,
  payload_storage_path text not null,
  payload_content_type text,
  status public.transcript_status not null default 'stored',
  quarantine_reason text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (project_id, tenant_id) references public.projects (id, tenant_id),
  foreign key (department_id, tenant_id) references public.departments (id, tenant_id),
  constraint transcripts_filing_check check (
    (filing_kind = 'project' and project_id is not null)
    or (filing_kind = 'cross_functional' and project_id is not null)
    or (filing_kind = 'unassigned' and project_id is null)
    or (filing_kind = 'non_project' and project_id is null and department_id is not null)
  ),
  constraint transcripts_quarantine_check check (
    (status = 'stored' and quarantine_reason is null)
    or (status = 'quarantined' and quarantine_reason is not null)
  )
);

create unique index transcripts_source_identity
  on public.transcripts (tenant_id, source_system, source_external_id)
  where source_external_id is not null;

create table public.transcript_speakers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  transcript_id uuid not null,
  label text not null,
  foreign key (transcript_id, tenant_id) references public.transcripts (id, tenant_id) on delete cascade
);

create table public.transcript_related_projects (
  tenant_id uuid not null,
  transcript_id uuid not null,
  project_id uuid not null,
  primary key (transcript_id, project_id),
  foreign key (transcript_id, tenant_id) references public.transcripts (id, tenant_id) on delete cascade,
  foreign key (project_id, tenant_id) references public.projects (id, tenant_id) on delete cascade
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  kind public.job_kind not null,
  status public.job_status not null,
  transcript_id uuid,
  failure_reason text,
  attempt_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (transcript_id, tenant_id) references public.transcripts (id, tenant_id) on delete cascade,
  constraint jobs_attempt_count_check check (attempt_count >= 0)
);

create table public.job_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  job_id uuid not null,
  status public.job_status not null,
  detail text,
  created_at timestamptz not null default now(),
  foreign key (job_id, tenant_id) references public.jobs (id, tenant_id) on delete cascade
);

create table public.knowledge_units (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  project_id uuid,
  transcript_id uuid not null,
  extraction_job_id uuid,
  unit_type public.unit_type not null,
  title text not null,
  body text not null,
  review_state public.review_state not null default 'proposed',
  proposed_title text not null,
  proposed_body text not null,
  source_excerpt text,
  owner_name text,
  owner_presence public.field_presence not null default 'unknown',
  dependencies jsonb not null default '[]'::jsonb,
  dependencies_presence public.field_presence not null default 'unknown',
  systems_touched text[] not null default '{}',
  systems_presence public.field_presence not null default 'unknown',
  acceptance_criteria text,
  acceptance_presence public.field_presence not null default 'unknown',
  due_date date,
  due_presence public.field_presence not null default 'unknown',
  approval_required boolean,
  approval_presence public.field_presence not null default 'unknown',
  extracted_at timestamptz not null default now(),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (project_id, tenant_id) references public.projects (id, tenant_id),
  foreign key (transcript_id, tenant_id) references public.transcripts (id, tenant_id) on delete cascade,
  foreign key (extraction_job_id, tenant_id) references public.jobs (id, tenant_id),
  constraint knowledge_units_owner_check check (
    (owner_presence = 'unknown' and owner_name is null)
    or (owner_presence = 'known' and owner_name is not null and btrim(owner_name) <> '')
  ),
  constraint knowledge_units_dependencies_check check (
    (dependencies_presence = 'unknown' and dependencies = '[]'::jsonb)
    or (dependencies_presence = 'known' and jsonb_typeof(dependencies) = 'array')
  ),
  constraint knowledge_units_systems_check check (
    (systems_presence = 'unknown' and cardinality(systems_touched) = 0)
    or systems_presence = 'known'
  ),
  constraint knowledge_units_acceptance_check check (
    (acceptance_presence = 'unknown' and acceptance_criteria is null)
    or (acceptance_presence = 'known' and acceptance_criteria is not null and btrim(acceptance_criteria) <> '')
  ),
  constraint knowledge_units_due_check check (
    (due_presence = 'unknown' and due_date is null)
    or (due_presence = 'known' and due_date is not null)
  ),
  constraint knowledge_units_approval_check check (
    (approval_presence = 'unknown' and approval_required is null)
    or (approval_presence = 'known' and approval_required is not null)
  )
);

create index knowledge_units_review_idx
  on public.knowledge_units (tenant_id, review_state, created_at);

create table public.review_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  knowledge_unit_id uuid not null,
  actor_id uuid references auth.users (id) on delete set null,
  action public.review_action not null,
  note text,
  created_at timestamptz not null default now(),
  foreign key (knowledge_unit_id, tenant_id) references public.knowledge_units (id, tenant_id) on delete cascade
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger jobs_touch_updated_at
  before update on public.jobs
  for each row execute function public.touch_updated_at();

create trigger knowledge_units_touch_updated_at
  before update on public.knowledge_units
  for each row execute function public.touch_updated_at();

create or replace function public.knowledge_units_review_columns_only()
returns trigger
language plpgsql
as $$
begin
  if new.tenant_id is distinct from old.tenant_id
    or new.project_id is distinct from old.project_id
    or new.transcript_id is distinct from old.transcript_id
    or new.extraction_job_id is distinct from old.extraction_job_id
    or new.unit_type is distinct from old.unit_type
    or new.title is distinct from old.title
    or new.body is distinct from old.body
    or new.proposed_title is distinct from old.proposed_title
    or new.proposed_body is distinct from old.proposed_body
    or new.source_excerpt is distinct from old.source_excerpt
    or new.owner_name is distinct from old.owner_name
    or new.owner_presence is distinct from old.owner_presence
    or new.dependencies is distinct from old.dependencies
    or new.dependencies_presence is distinct from old.dependencies_presence
    or new.systems_touched is distinct from old.systems_touched
    or new.systems_presence is distinct from old.systems_presence
    or new.acceptance_criteria is distinct from old.acceptance_criteria
    or new.acceptance_presence is distinct from old.acceptance_presence
    or new.due_date is distinct from old.due_date
    or new.due_presence is distinct from old.due_presence
    or new.approval_required is distinct from old.approval_required
    or new.approval_presence is distinct from old.approval_presence
    or new.extracted_at is distinct from old.extracted_at
    or new.created_at is distinct from old.created_at
  then
    raise exception 'review_fields_only' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger knowledge_units_review_columns_only
  before update on public.knowledge_units
  for each row execute function public.knowledge_units_review_columns_only();

-- Security definer helpers bypass RLS so policies can call them without recursion.
-- They answer questions about auth.uid() only.

create or replace function public.tenant_role(tid uuid)
returns public.tenant_role
language sql
stable
security definer
set search_path = public
as $$
  select m.role
  from public.tenant_memberships m
  where m.tenant_id = tid
    and m.user_id = auth.uid();
$$;

create or replace function public.is_tenant_member(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.tenant_role(tid) is not null;
$$;

create or replace function public.can_read_project(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects p
    join public.tenant_memberships m
      on m.tenant_id = p.tenant_id
     and m.user_id = auth.uid()
    where p.id = pid
      and (
        m.role = 'admin'
        or exists (
          select 1
          from public.project_memberships pm
          where pm.project_id = p.id
            and pm.user_id = auth.uid()
        )
      )
  );
$$;

create or replace function public.can_read_transcript(transcript_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.transcripts t
    join public.tenant_memberships m
      on m.tenant_id = t.tenant_id
     and m.user_id = auth.uid()
    where t.id = transcript_id
      and (
        m.role = 'admin'
        or (
          m.role = 'reviewer'
          and (
            t.project_id is null
            or exists (
              select 1
              from public.project_memberships pm
              where pm.project_id = t.project_id
                and pm.user_id = auth.uid()
            )
          )
        )
        or (
          t.project_id is not null
          and exists (
            select 1
            from public.project_memberships pm
            where pm.project_id = t.project_id
              and pm.user_id = auth.uid()
              and pm.can_read_transcripts
          )
        )
      )
  );
$$;

create or replace function public.can_read_unit(unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.knowledge_units u
    join public.tenant_memberships m
      on m.tenant_id = u.tenant_id
     and m.user_id = auth.uid()
    where u.id = unit_id
      and (
        m.role = 'admin'
        or (
          (
            u.project_id is null and m.role in ('reviewer', 'approver')
            or exists (
              select 1
              from public.project_memberships pm
              where pm.project_id = u.project_id
                and pm.user_id = auth.uid()
            )
          )
          and (
            m.role in ('reviewer', 'approver')
            or u.review_state in ('accepted', 'edited', 'merged')
          )
        )
      )
  );
$$;

create or replace function public.can_review_unit(unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.knowledge_units u
    join public.tenant_memberships m
      on m.tenant_id = u.tenant_id
     and m.user_id = auth.uid()
    where u.id = unit_id
      and m.role in ('admin', 'reviewer')
      and (
        m.role = 'admin'
        or u.project_id is null
        or exists (
          select 1
          from public.project_memberships pm
          where pm.project_id = u.project_id
            and pm.user_id = auth.uid()
        )
      )
  );
$$;

create or replace function public.review_unit(unit_id uuid, action text)
returns public.knowledge_units
language plpgsql
security invoker
set search_path = public
as $$
declare
  updated public.knowledge_units;
  next_state public.review_state;
begin
  if action not in ('accept', 'reject') then
    raise exception 'invalid_action' using errcode = '22023';
  end if;

  next_state := case
    when action = 'accept' then 'accepted'::public.review_state
    else 'rejected'::public.review_state
  end;

  insert into public.review_events (tenant_id, knowledge_unit_id, actor_id, action)
  select u.tenant_id, u.id, auth.uid(), action::public.review_action
  from public.knowledge_units u
  where u.id = unit_id
    and u.review_state = 'proposed'
    and public.can_review_unit(u.id);

  update public.knowledge_units
  set review_state = next_state,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = unit_id
    and review_state = 'proposed'
    and public.can_review_unit(id)
  returning * into updated;

  if not found then
    raise exception 'review_rejected' using errcode = '42501';
  end if;

  return updated;
end;
$$;

alter table public.tenants enable row level security;
alter table public.tenant_memberships enable row level security;
alter table public.departments enable row level security;
alter table public.projects enable row level security;
alter table public.project_memberships enable row level security;
alter table public.transcripts enable row level security;
alter table public.transcript_speakers enable row level security;
alter table public.transcript_related_projects enable row level security;
alter table public.jobs enable row level security;
alter table public.job_events enable row level security;
alter table public.knowledge_units enable row level security;
alter table public.review_events enable row level security;

create policy tenants_select on public.tenants
  for select to authenticated
  using (public.is_tenant_member(id));

create policy tenant_memberships_select on public.tenant_memberships
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.tenant_role(tenant_id) = 'admin'
  );

create policy departments_select on public.departments
  for select to authenticated
  using (
    public.tenant_role(tenant_id) = 'admin'
    or exists (
      select 1
      from public.projects p
      where p.department_id = departments.id
        and public.can_read_project(p.id)
    )
    or (
      public.tenant_role(tenant_id) in ('reviewer', 'approver')
      and exists (
        select 1
        from public.transcripts t
        where t.department_id = departments.id
          and public.can_read_transcript(t.id)
      )
    )
  );

create policy projects_select on public.projects
  for select to authenticated
  using (public.can_read_project(id));

create policy project_memberships_select on public.project_memberships
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.tenant_role(tenant_id) = 'admin'
  );

create policy transcripts_select on public.transcripts
  for select to authenticated
  using (public.can_read_transcript(id));

create policy transcript_speakers_select on public.transcript_speakers
  for select to authenticated
  using (public.can_read_transcript(transcript_id));

create policy transcript_related_projects_select on public.transcript_related_projects
  for select to authenticated
  using (public.can_read_transcript(transcript_id));

create policy jobs_select on public.jobs
  for select to authenticated
  using (public.tenant_role(tenant_id) in ('admin', 'reviewer', 'approver'));

create policy job_events_select on public.job_events
  for select to authenticated
  using (public.tenant_role(tenant_id) in ('admin', 'reviewer', 'approver'));

create policy knowledge_units_select on public.knowledge_units
  for select to authenticated
  using (public.can_read_unit(id));

create policy knowledge_units_update on public.knowledge_units
  for update to authenticated
  using (review_state = 'proposed' and public.can_review_unit(id))
  with check (
    review_state in ('accepted', 'rejected')
    and reviewed_by = auth.uid()
  );

create policy review_events_select on public.review_events
  for select to authenticated
  using (public.can_read_unit(knowledge_unit_id));

create policy review_events_insert on public.review_events
  for insert to authenticated
  with check (
    actor_id = auth.uid()
    and exists (
      select 1
      from public.knowledge_units u
      where u.id = knowledge_unit_id
        and u.review_state = 'proposed'
        and public.can_review_unit(u.id)
    )
  );

revoke all on all tables in schema public from anon, authenticated;
grant select on
  public.tenants,
  public.tenant_memberships,
  public.departments,
  public.projects,
  public.project_memberships,
  public.transcripts,
  public.transcript_speakers,
  public.transcript_related_projects,
  public.jobs,
  public.job_events,
  public.knowledge_units,
  public.review_events
to authenticated;

grant update (review_state, reviewed_by, reviewed_at) on public.knowledge_units to authenticated;
grant insert (tenant_id, knowledge_unit_id, actor_id, action, note) on public.review_events to authenticated;

revoke all on function public.tenant_role(uuid) from public, anon;
revoke all on function public.is_tenant_member(uuid) from public, anon;
revoke all on function public.can_read_project(uuid) from public, anon;
revoke all on function public.can_read_transcript(uuid) from public, anon;
revoke all on function public.can_read_unit(uuid) from public, anon;
revoke all on function public.can_review_unit(uuid) from public, anon;
revoke all on function public.review_unit(uuid, text) from public, anon;

grant execute on function public.tenant_role(uuid) to authenticated;
grant execute on function public.is_tenant_member(uuid) to authenticated;
grant execute on function public.can_read_project(uuid) to authenticated;
grant execute on function public.can_read_transcript(uuid) to authenticated;
grant execute on function public.can_read_unit(uuid) to authenticated;
grant execute on function public.can_review_unit(uuid) to authenticated;
grant execute on function public.review_unit(uuid, text) to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on all tables in schema public to service_role;
    grant execute on all functions in schema public to service_role;
  end if;
  if exists (select 1 from information_schema.schemata where schema_name = 'storage')
     and exists (
       select 1 from information_schema.tables
       where table_schema = 'storage' and table_name = 'buckets'
     ) then
    insert into storage.buckets (id, name, public)
    values ('transcript-payloads', 'transcript-payloads', false)
    on conflict (id) do nothing;
  end if;
end $$;
