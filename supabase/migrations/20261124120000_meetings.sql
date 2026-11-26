-- Flux meeting bot tables. Apply only to a local database, after
-- 20261108120000_core.sql and 20261123120000_entities.sql.
-- Do not apply this file to a hosted project.
-- project_id points at public.entity_projects, not the pilot public.projects table.
--
-- Zero retention: meeting_artifacts stores a hash, a segment count, speaker
-- labels, and pointers. It has no transcript text, recording bytes, or download URL.
-- calendar_event_id is reserved for a later Calendar V2 slice and stays null until then.

alter table public.entity_relationships drop constraint entity_relationships_from_type_check;
alter table public.entity_relationships drop constraint entity_relationships_to_type_check;

alter table public.entity_relationships
  add constraint entity_relationships_from_type_check check (
    from_type in (
      'system', 'environment', 'data_source', 'table_schema', 'integration',
      'workflow', 'project', 'requirement', 'use_case', 'test_case',
      'milestone', 'decision', 'person_role', 'action_item'
    )
  );

alter table public.entity_relationships
  add constraint entity_relationships_to_type_check check (
    to_type in (
      'system', 'environment', 'data_source', 'table_schema', 'integration',
      'workflow', 'project', 'requirement', 'use_case', 'test_case',
      'milestone', 'decision', 'person_role', 'action_item'
    )
  );

create table public.action_items (
  id text primary key,
  name text not null,
  summary text not null,
  project_id text not null references public.entity_projects (id),
  meeting_id text,
  owner_role_id text references public.person_roles (id),
  state text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint action_items_name_check check (btrim(name) <> ''),
  constraint action_items_summary_check check (btrim(summary) <> ''),
  constraint action_items_state_check check (state in ('open', 'done'))
);

create table public.meetings (
  id text primary key,
  title text not null,
  project_id text references public.entity_projects (id),
  calendar_event_id text,
  decision_id text references public.decisions (id),
  meeting_url text,
  starts_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meetings_title_check check (btrim(title) <> '')
);

comment on column public.meetings.calendar_event_id is
  'Reserved for Calendar V2 auto-join. Null in this slice.';

alter table public.action_items
  add constraint action_items_meeting_id_fkey
  foreign key (meeting_id) references public.meetings (id);

create table public.bots (
  id text primary key,
  meeting_id text not null references public.meetings (id),
  recall_bot_id text not null,
  status text not null,
  join_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bots_recall_bot_id_unique unique (recall_bot_id),
  constraint bots_status_check check (btrim(status) <> '')
);

create table public.meeting_artifacts (
  id text primary key,
  meeting_id text not null references public.meetings (id),
  bot_id text references public.bots (id),
  kind text not null,
  content_sha256 text not null,
  segment_count integer not null,
  speakers jsonb not null,
  recall_transcript_id text,
  recall_recording_id text,
  conversation_unit_path text,
  decision_unit_path text,
  created_at timestamptz not null default now(),
  constraint meeting_artifacts_kind_check check (kind in ('transcript', 'recording')),
  constraint meeting_artifacts_hash_check check (content_sha256 ~ '^[0-9a-f]{64}$'),
  constraint meeting_artifacts_hash_unique unique (content_sha256),
  constraint meeting_artifacts_segment_count_check check (segment_count >= 0),
  constraint meeting_artifacts_speakers_check check (jsonb_typeof(speakers) = 'array')
);

comment on table public.meeting_artifacts is
  'Hash, segment count, speakers, and pointers only. Transcript text is discarded before insert.';

create index action_items_project_id_idx on public.action_items (project_id);
create index action_items_meeting_id_idx on public.action_items (meeting_id);
create index meetings_project_id_idx on public.meetings (project_id);
create index bots_meeting_id_idx on public.bots (meeting_id);
create index meeting_artifacts_meeting_id_idx on public.meeting_artifacts (meeting_id);

create trigger action_items_touch_updated_at
  before update on public.action_items
  for each row execute function public.flux_touch_updated_at();

create trigger meetings_touch_updated_at
  before update on public.meetings
  for each row execute function public.flux_touch_updated_at();

create trigger bots_touch_updated_at
  before update on public.bots
  for each row execute function public.flux_touch_updated_at();

do $meeting_lock$
declare
  rel text;
begin
  foreach rel in array array['action_items', 'meetings', 'bots', 'meeting_artifacts']
  loop
    execute format('alter table public.%I enable row level security', rel);
    execute format('revoke all on table public.%I from public', rel);
  end loop;
end
$meeting_lock$;

do $meeting_read$
declare
  rel text;
begin
  if not (
    exists (select 1 from pg_roles where rolname = 'anon')
    and exists (select 1 from pg_roles where rolname = 'authenticated')
  ) then
    raise notice 'meeting read grants skipped; anon and authenticated are absent';
    return;
  end if;

  foreach rel in array array['action_items', 'meetings', 'bots', 'meeting_artifacts']
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
$meeting_read$;
