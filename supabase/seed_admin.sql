-- Local seed for the Hearthline workspace, one admin role, and two API tokens.
-- Apply after 20261125120000_admin_tokens.sql and supabase/seed_meetings.sql.
-- Not applied to a hosted project.
-- Token rows store HMAC-SHA256 hashes only. The plaintext tokens are not in this file.
-- The hashes were produced with the fixture pepper used by the token tests.

begin;

insert into public.workspaces (id, name, slug) values
  ('workspace.hearthline', 'Hearthline Instruments', 'hearthline')
on conflict (id) do nothing;

insert into public.subscribers (id, workspace_id, display_name, email) values
  (
    'subscriber.hearthline-admin',
    'workspace.hearthline',
    'Workspace admin',
    'workspace-admin@hearthline.test'
  ),
  (
    'subscriber.hearthline-editor',
    'workspace.hearthline',
    'Catalog editor',
    'catalog-editor@hearthline.test'
  )
on conflict (id) do nothing;

insert into public.admin_roles (subscriber_id, workspace_id) values
  ('subscriber.hearthline-admin', 'workspace.hearthline')
on conflict (subscriber_id) do nothing;

insert into public.api_tokens (
  id,
  subscriber_id,
  workspace_id,
  label,
  token_hash,
  prefix,
  last4,
  scopes,
  expires_at,
  revoked_at,
  last_used_at,
  created_at
) values
  (
    'token.hearthline-active',
    'subscriber.hearthline-admin',
    'workspace.hearthline',
    'Catalog and meetings',
    '72bbb9089368df298a0e1d969e88a35c4f8da108c0009dac3e2219c690d425ff',
    'flux_',
    'LHpU',
    array['units:read', 'entities:read', 'meetings:write', 'action_items:read']::text[],
    '2036-11-24 00:00:00+00',
    null,
    null,
    '2026-11-20 15:00:00+00'
  ),
  (
    'token.hearthline-revoked',
    'subscriber.hearthline-admin',
    'workspace.hearthline',
    'Retired catalog reader',
    '56c0a5cf5f9c143818889a3f925ddaad3f3cc447f7c56963861e4c5d88781229',
    'flux_',
    'q7A8',
    array['units:read']::text[],
    '2036-11-24 00:00:00+00',
    '2026-11-21 15:00:00+00',
    null,
    '2026-11-20 15:00:00+00'
  )
on conflict (id) do nothing;

insert into public.audit_log (id, actor_subscriber_id, action, target, detail, created_at) values
  (
    'audit.token-active-create',
    'subscriber.hearthline-admin',
    'token.create',
    'token.hearthline-active',
    '{"prefix":"flux_","last4":"LHpU"}'::jsonb,
    '2026-11-20 15:00:00+00'
  ),
  (
    'audit.token-revoked-create',
    'subscriber.hearthline-admin',
    'token.create',
    'token.hearthline-revoked',
    '{"prefix":"flux_","last4":"q7A8"}'::jsonb,
    '2026-11-20 15:00:00+00'
  ),
  (
    'audit.token-revoked',
    'subscriber.hearthline-admin',
    'token.revoke',
    'token.hearthline-revoked',
    '{"prefix":"flux_","last4":"q7A8"}'::jsonb,
    '2026-11-21 15:00:00+00'
  )
on conflict (id) do nothing;

insert into public.bots (id, meeting_id, recall_bot_id, status, join_at) values
  (
    'bot.kilnwatch-seed',
    'meeting.kilnwatch-release-standup',
    'recall-seed-hearthline',
    'done',
    null
  )
on conflict (id) do nothing;

commit;
