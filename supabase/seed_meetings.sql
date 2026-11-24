-- Local seed for one Hearthline meeting. Apply after seed_entities.sql.
-- Not applied to a hosted project. No transcript text is stored.
-- content_sha256 is the hash of the label hearthline-kilnwatch-release-standup,
-- not a recording and not a transcript.

begin;

insert into public.meetings (
  id, title, project_id, calendar_event_id, decision_id, starts_at
) values (
  'meeting.kilnwatch-release-standup',
  'Kilnwatch release standup',
  'project.kilnwatch',
  null,
  'decision.ship-curve-sheet-without-audio',
  '2026-11-20 15:00:00+00'
)
on conflict (id) do nothing;

update public.action_items
set meeting_id = 'meeting.kilnwatch-release-standup'
where id in (
  'action-item.publish-bench-checklist',
  'action-item.note-portal-handoff'
);

insert into public.meeting_artifacts (
  id,
  meeting_id,
  bot_id,
  kind,
  content_sha256,
  segment_count,
  speakers,
  recall_transcript_id,
  recall_recording_id,
  conversation_unit_path,
  decision_unit_path
) values (
  'artifact.kilnwatch-release-standup',
  'meeting.kilnwatch-release-standup',
  null,
  'transcript',
  'e37eae4cbedc025c767b710517bf7cf7815be7628e48c1403415b272cee81917',
  4,
  '["Catalog editor","Calibration owner","Studio lead"]'::jsonb,
  null,
  null,
  null,
  null
)
on conflict (id) do nothing;

commit;
