-- Local seed for the Flux entity tables. Not applied to a hosted project.
-- Apply 20261124120000_meetings.sql before this file. It creates action_items.
-- Ids match ontology/seed/entities.json and ontology/seed/relationships.json.
-- commit_sha is null: git history is the version log until a sync pins a SHA.
-- This file does not store transcripts or recordings.

begin;

insert into public.person_roles (id, name, summary) values
  ('person-role.calibration-owner', 'Calibration owner', 'Owns the calibration check on the bench.'),
  ('person-role.studio-lead', 'Studio lead', 'Opens released curves for a teaching studio.'),
  ('person-role.catalog-editor', 'Catalog editor', 'Owns governed units in the catalog.')
on conflict (id) do nothing;

insert into public.systems (id, name, summary, kind, status) values
  ('system.kiln-ledger', 'Kiln Ledger', 'Bench log of firing curves for the Kilnwatch instrument.', 'product', 'active'),
  ('system.studio-portal', 'Studio Portal', 'Studio view of the curves a teaching studio is allowed to see.', 'product', 'active'),
  ('system.glaze-notebook', 'Glaze Notebook', 'Proposed notebook for glaze recipes. Not connected to Kilnwatch curves.', 'product', 'proposed')
on conflict (id) do nothing;

insert into public.projects (id, name, summary, status) values
  ('project.kilnwatch', 'Kilnwatch teaching release', 'Teaching release of the Kilnwatch instrument software.', 'active')
on conflict (id) do nothing;

insert into public.environments (id, name, summary, system_id, stage) values
  ('environment.kiln-ledger-bench', 'Kiln Ledger bench', 'Bench where Kiln Ledger is exercised before a teaching day.', 'system.kiln-ledger', 'bench'),
  ('environment.studio-portal-demo', 'Studio Portal demo', 'Demo studio used to read a released curve.', 'system.studio-portal', 'studio')
on conflict (id) do nothing;

insert into public.data_sources (id, name, summary, system_id, source_kind) values
  ('data-source.firing-curves', 'Firing curves', 'Reduced firing curves. No recordings.', 'system.kiln-ledger', 'table')
on conflict (id) do nothing;

insert into public.table_schemas (id, name, summary, data_source_id, columns) values
  (
    'table-schema.firing-curve',
    'Firing curve table',
    'Columns stored for one firing curve.',
    'data-source.firing-curves',
    '[
      {"name":"curve_id","description":"Stable id for one firing curve."},
      {"name":"studio_code","description":"Short code for the teaching studio."},
      {"name":"peak_celsius","description":"Highest temperature recorded on the curve."},
      {"name":"recorded_on","description":"Calendar day the firing was logged."}
    ]'::jsonb
  )
on conflict (id) do nothing;

insert into public.integrations (id, name, summary, from_system_id, to_system_id, status) values
  (
    'integration.ledger-to-portal',
    'Ledger to portal',
    'Copies a released curve from Kiln Ledger to Studio Portal.',
    'system.kiln-ledger',
    'system.studio-portal',
    'active'
  )
on conflict (id) do nothing;

insert into public.workflows (id, name, summary, project_id) values
  ('workflow.calibration-check', 'Calibration check', 'Check the bench before a curve is released.', 'project.kilnwatch')
on conflict (id) do nothing;

insert into public.requirements (id, name, summary, project_id, statement) values
  (
    'requirement.studio-sees-own-curve',
    'Studio sees its own curve',
    'A studio can read only the curves released for its studio code.',
    'project.kilnwatch',
    'A studio can read only the curves released for its studio code.'
  )
on conflict (id) do nothing;

insert into public.use_cases (id, name, summary, system_id, actor_role_id) values
  (
    'use-case.instructor-opens-curve',
    'Instructor opens a curve',
    'A studio lead opens one released curve in Studio Portal.',
    'system.studio-portal',
    'person-role.studio-lead'
  )
on conflict (id) do nothing;

insert into public.test_cases (id, name, summary, requirement_id, expected) values
  (
    'test-case.curve-stays-in-studio',
    'Curve stays in the studio',
    'A curve released for one studio code is not listed for another.',
    'requirement.studio-sees-own-curve',
    'The other studio code sees an empty sheet.'
  )
on conflict (id) do nothing;

insert into public.milestones (id, name, summary, project_id, target_on, status) values
  (
    'milestone.bench-demo',
    'Bench demo',
    'Bench demo of a released curve on the portal.',
    'project.kilnwatch',
    '2026-12-01',
    'planned'
  )
on conflict (id) do nothing;

insert into public.decisions (id, name, summary, project_id, state) values
  (
    'decision.no-recordings',
    'No firing recordings',
    'Firing recordings are not stored.',
    'project.kilnwatch',
    'accepted'
  ),
  (
    'decision.ship-curve-sheet-without-audio',
    'Ship the curve sheet without stored audio',
    'The Kilnwatch release ships the curve sheet. The standup audio is not stored.',
    'project.kilnwatch',
    'accepted'
  )
on conflict (id) do nothing;

insert into public.action_items (id, name, summary, project_id, owner_role_id, state) values
  (
    'action-item.publish-bench-checklist',
    'Publish the bench checklist',
    'Publish the bench checklist before the Kilnwatch teaching release.',
    'project.kilnwatch',
    'person-role.calibration-owner',
    'open'
  ),
  (
    'action-item.note-portal-handoff',
    'Note the portal handoff',
    'Note the Studio Portal handoff in the catalog.',
    'project.kilnwatch',
    'person-role.studio-lead',
    'open'
  )
on conflict (id) do nothing;

insert into public.entity_relationships (id, relationship_type, from_type, from_id, to_type, to_id) values
  ('rel.hosts.kiln-ledger-bench', 'hosts', 'system', 'system.kiln-ledger', 'environment', 'environment.kiln-ledger-bench'),
  ('rel.hosts.studio-portal-demo', 'hosts', 'system', 'system.studio-portal', 'environment', 'environment.studio-portal-demo'),
  ('rel.exposes.firing-curves', 'exposes', 'system', 'system.kiln-ledger', 'data_source', 'data-source.firing-curves'),
  ('rel.describes.firing-curve', 'describes', 'data_source', 'data-source.firing-curves', 'table_schema', 'table-schema.firing-curve'),
  ('rel.connects.ledger-portal', 'connects', 'system', 'system.kiln-ledger', 'system', 'system.studio-portal'),
  ('rel.carries.ledger-to-portal', 'carries', 'integration', 'integration.ledger-to-portal', 'data_source', 'data-source.firing-curves'),
  ('rel.supports.calibration-check', 'supports', 'workflow', 'workflow.calibration-check', 'project', 'project.kilnwatch'),
  ('rel.tracks.studio-sees-own-curve', 'tracks', 'project', 'project.kilnwatch', 'requirement', 'requirement.studio-sees-own-curve'),
  ('rel.verifies.curve-stays-in-studio', 'verifies', 'test_case', 'test-case.curve-stays-in-studio', 'requirement', 'requirement.studio-sees-own-curve'),
  ('rel.schedules.bench-demo', 'schedules', 'project', 'project.kilnwatch', 'milestone', 'milestone.bench-demo'),
  ('rel.exercises.instructor-opens-curve', 'exercises', 'use_case', 'use-case.instructor-opens-curve', 'system', 'system.studio-portal'),
  ('rel.performed-by.instructor-opens-curve', 'performed_by', 'use_case', 'use-case.instructor-opens-curve', 'person_role', 'person-role.studio-lead'),
  ('rel.governs.no-recordings', 'governs', 'decision', 'decision.no-recordings', 'project', 'project.kilnwatch'),
  ('rel.staffs.calibration-check', 'staffs', 'person_role', 'person-role.calibration-owner', 'workflow', 'workflow.calibration-check'),
  ('rel.governs.ship-curve-sheet-without-audio', 'governs', 'decision', 'decision.ship-curve-sheet-without-audio', 'project', 'project.kilnwatch'),
  ('rel.assigns.publish-bench-checklist', 'assigns', 'action_item', 'action-item.publish-bench-checklist', 'person_role', 'person-role.calibration-owner'),
  ('rel.assigns.note-portal-handoff', 'assigns', 'action_item', 'action-item.note-portal-handoff', 'person_role', 'person-role.studio-lead'),
  ('rel.follows.publish-bench-checklist', 'follows', 'action_item', 'action-item.publish-bench-checklist', 'decision', 'decision.ship-curve-sheet-without-audio'),
  ('rel.follows.note-portal-handoff', 'follows', 'action_item', 'action-item.note-portal-handoff', 'decision', 'decision.ship-curve-sheet-without-audio')
on conflict (id) do nothing;

insert into public.unit_refs (id, bucket, title, version, status, owner, repo_path, commit_sha, supersedes) values
  ('kiln-ledger-split', 'architecture', 'Kiln Ledger and Studio Portal stay separate', 1, 'accepted', 'person-role.catalog-editor', 'units/architecture/kiln-ledger-split/UNIT.md', null, null),
  ('studio-firing-sheet', 'design', 'Studio firing sheet', 1, 'accepted', 'person-role.catalog-editor', 'units/design/studio-firing-sheet/UNIT.md', null, null),
  ('bench-handoff-notes', 'conversations', 'Bench handoff for the calibration check', 1, 'accepted', 'person-role.studio-lead', 'units/conversations/bench-handoff-notes/UNIT.md', null, null),
  ('firing-recordings-stay-out', 'decisions', 'Firing recordings stay out of the database', 1, 'accepted', 'person-role.catalog-editor', 'units/decisions/firing-recordings-stay-out/UNIT.md', null, null),
  ('calibration-check', 'procedures', 'Calibration check procedure', 1, 'accepted', 'person-role.calibration-owner', 'units/procedures/calibration-check/UNIT.md', null, null)
on conflict (id) do nothing;

insert into public.unit_ref_entities (unit_id, entity_id) values
  ('kiln-ledger-split', 'system.kiln-ledger'),
  ('kiln-ledger-split', 'system.studio-portal'),
  ('kiln-ledger-split', 'system.glaze-notebook'),
  ('kiln-ledger-split', 'integration.ledger-to-portal'),
  ('studio-firing-sheet', 'system.studio-portal'),
  ('studio-firing-sheet', 'use-case.instructor-opens-curve'),
  ('studio-firing-sheet', 'table-schema.firing-curve'),
  ('bench-handoff-notes', 'workflow.calibration-check'),
  ('bench-handoff-notes', 'person-role.calibration-owner'),
  ('bench-handoff-notes', 'person-role.studio-lead'),
  ('bench-handoff-notes', 'environment.kiln-ledger-bench'),
  ('firing-recordings-stay-out', 'decision.no-recordings'),
  ('firing-recordings-stay-out', 'requirement.studio-sees-own-curve'),
  ('firing-recordings-stay-out', 'data-source.firing-curves'),
  ('calibration-check', 'workflow.calibration-check'),
  ('calibration-check', 'environment.kiln-ledger-bench'),
  ('calibration-check', 'person-role.calibration-owner'),
  ('calibration-check', 'system.kiln-ledger')
on conflict (unit_id, entity_id) do nothing;

commit;
