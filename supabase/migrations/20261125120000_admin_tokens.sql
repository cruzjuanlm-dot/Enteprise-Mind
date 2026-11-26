-- Flux admin, subscribers, and API tokens.
-- Apply only to a local database, after core, entities, and meetings, in timestamp order.
-- Do not apply this file to a hosted project.
--
-- api_tokens.token_hash is an HMAC-SHA256 of the token using the server pepper.
-- The plaintext token is not a column. anon and authenticated cannot select the hash.

create table public.workspaces (
  id text primary key,
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspaces_name_check check (btrim(name) <> ''),
  constraint workspaces_slug_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint workspaces_slug_unique unique (slug)
);

create table public.subscribers (
  id text primary key,
  workspace_id text not null references public.workspaces (id),
  display_name text not null,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscribers_display_name_check check (btrim(display_name) <> ''),
  constraint subscribers_email_check check (position('@' in email) > 1),
  constraint subscribers_email_unique unique (email)
);

create table public.admin_roles (
  subscriber_id text primary key references public.subscribers (id),
  workspace_id text not null references public.workspaces (id),
  created_at timestamptz not null default now()
);

create table public.api_tokens (
  id text primary key,
  subscriber_id text not null references public.subscribers (id),
  workspace_id text not null references public.workspaces (id),
  label text not null,
  token_hash text not null,
  prefix text not null,
  last4 text not null,
  scopes text[] not null,
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint api_tokens_label_check check (btrim(label) <> ''),
  constraint api_tokens_hash_unique unique (token_hash),
  constraint api_tokens_hash_check check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint api_tokens_prefix_check check (prefix = 'flux_'),
  constraint api_tokens_last4_check check (char_length(last4) = 4),
  constraint api_tokens_scopes_check check (
    cardinality(scopes) > 0
    and scopes <@ array['units:read', 'entities:read', 'meetings:write', 'action_items:read']::text[]
  )
);

comment on column public.api_tokens.token_hash is
  'HMAC-SHA256 hex of the token keyed by the server pepper. Plaintext is not stored.';

create table public.audit_log (
  id text primary key,
  actor_subscriber_id text references public.subscribers (id),
  action text not null,
  target text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_log_action_check check (
    action in ('token.create', 'token.revoke', 'admin.view', 'admin.session')
  ),
  constraint audit_log_detail_object_check check (jsonb_typeof(detail) = 'object'),
  constraint audit_log_detail_secret_check check (
    not (
      detail ? 'plaintext'
      or detail ? 'token'
      or detail ? 'secret'
      or detail ? 'token_hash'
      or detail ? 'authorization'
      or detail ? 'pepper'
    )
  )
);

create index subscribers_workspace_id_idx on public.subscribers (workspace_id);
create index api_tokens_subscriber_id_idx on public.api_tokens (subscriber_id);
create index audit_log_actor_idx on public.audit_log (actor_subscriber_id);

create trigger workspaces_touch_updated_at
  before update on public.workspaces
  for each row execute function public.flux_touch_updated_at();

create trigger subscribers_touch_updated_at
  before update on public.subscribers
  for each row execute function public.flux_touch_updated_at();

create or replace function public.flux_current_subscriber_id()
returns text
language sql
stable
set search_path = public
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')
$$;

revoke all on function public.flux_current_subscriber_id() from public;

do $admin_lock$
declare
  rel text;
begin
  foreach rel in array array['workspaces', 'subscribers', 'admin_roles', 'api_tokens', 'audit_log']
  loop
    execute format('alter table public.%I enable row level security', rel);
    execute format('revoke all on table public.%I from public', rel);
  end loop;
end
$admin_lock$;

do $admin_read$
begin
  if not (
    exists (select 1 from pg_roles where rolname = 'anon')
    and exists (select 1 from pg_roles where rolname = 'authenticated')
  ) then
    raise notice 'admin token grants skipped; anon and authenticated are absent';
    return;
  end if;

  revoke all on table public.workspaces from anon, authenticated;
  revoke all on table public.subscribers from anon, authenticated;
  revoke all on table public.admin_roles from anon, authenticated;
  revoke all on table public.api_tokens from anon, authenticated;
  revoke all on table public.audit_log from anon, authenticated;

  grant select on table public.workspaces to authenticated;
  grant select on table public.subscribers to authenticated;
  grant select on table public.admin_roles to authenticated;
  grant select (
    id,
    subscriber_id,
    workspace_id,
    label,
    prefix,
    last4,
    scopes,
    expires_at,
    revoked_at,
    last_used_at,
    created_at
  ) on table public.api_tokens to authenticated;
  revoke select (token_hash) on table public.api_tokens from anon, authenticated;
  grant execute on function public.flux_current_subscriber_id() to authenticated;

  create policy workspaces_member_read on public.workspaces
    for select to authenticated
    using (
      id in (
        select workspace_id from public.subscribers
        where id = public.flux_current_subscriber_id()
      )
    );

  create policy subscribers_self_read on public.subscribers
    for select to authenticated
    using (id = public.flux_current_subscriber_id());

  create policy admin_roles_self_read on public.admin_roles
    for select to authenticated
    using (subscriber_id = public.flux_current_subscriber_id());

  create policy api_tokens_owner_read on public.api_tokens
    for select to authenticated
    using (subscriber_id = public.flux_current_subscriber_id());

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update, delete on table public.workspaces to service_role;
    grant select, insert, update, delete on table public.subscribers to service_role;
    grant select, insert, update, delete on table public.admin_roles to service_role;
    grant select, insert, update, delete on table public.api_tokens to service_role;
    grant select, insert, update, delete on table public.audit_log to service_role;
  end if;
end
$admin_read$;
