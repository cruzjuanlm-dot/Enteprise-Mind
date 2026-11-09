-- Fictional Hearthline Instruments hierarchy. Memberships are inserted after a real Supabase Auth user exists.
-- Replace the user id from the Auth dashboard. Do not put keys or passwords in this file.
-- Slug stays "pilot" so existing tenant resolution keeps working. Names are synthetic.

insert into public.tenants (id, name, slug)
values ('11111111-1111-4111-8111-111111111111', 'Hearthline Instruments', 'pilot')
on conflict (id) do nothing;

insert into public.departments (id, tenant_id, name)
values (
  '33333333-3333-4333-8333-333333333333',
  '11111111-1111-4111-8111-111111111111',
  'Field Systems'
)
on conflict (id) do nothing;

insert into public.projects (id, tenant_id, department_id, name)
values (
  '44444444-4444-4444-8444-444444444444',
  '11111111-1111-4111-8111-111111111111',
  '33333333-3333-4333-8333-333333333333',
  'Sensor firmware review'
)
on conflict (id) do nothing;

-- insert into public.tenant_memberships (tenant_id, user_id, role)
-- values ('11111111-1111-4111-8111-111111111111', '<auth-user-uuid>', 'reviewer');
--
-- insert into public.project_memberships (tenant_id, project_id, user_id, can_read_transcripts)
-- values (
--   '11111111-1111-4111-8111-111111111111',
--   '44444444-4444-4444-8444-444444444444',
--   '<auth-user-uuid>',
--   true
-- );
