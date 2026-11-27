import { DEMO_MEETING, loadMeetingBoard, MEETING_STEPS } from "@/lib/desk/meetings";
import { deskSnapshot } from "@/lib/desk/store";

export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  const board = await loadMeetingBoard();
  const step = Math.min(deskSnapshot().meetingStep, MEETING_STEPS.length - 1);
  const current = MEETING_STEPS[step] ?? MEETING_STEPS[0];

  return (
    <main className="page">
      <header className="page-head">
        <div>
          <h1>Meetings</h1>
          <p className="lede">
            Recall is mocked on this page. The sequence shows a bot joining, a transcript becoming ready, and the words
            being discarded. No request is sent.
          </p>
        </div>
      </header>
      {board.note ? <p className="notice">{board.note}</p> : null}
      <p className="meta">Showing {board.source === "supabase" ? "Supabase" : "the fictional seed"}.</p>
      <section className="stack" aria-labelledby="meetings-heading">
        <h2 id="meetings-heading">Workspace meetings</h2>
        <ul className="queue">
          {board.meetings.map((meeting) => (
            <li key={meeting.id}>
              <div>
                <span className="queue-title">{meeting.title}</span>
                <span className="meta">
                  {meeting.projectId}
                  {meeting.startsAt ? ` · ${meeting.startsAt}` : ""}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="detail" aria-labelledby="mock-heading">
        <div className="stack">
          <h2 id="mock-heading">Mocked Recall · {DEMO_MEETING.title}</h2>
          <dl className="fields">
            <div>
              <dt>When</dt>
              <dd>2026-11-20 15:00 UTC</dd>
            </div>
            <div>
              <dt>Bot</dt>
              <dd className="mono">{DEMO_MEETING.recallBotId}</dd>
            </div>
            <div>
              <dt>Speakers</dt>
              <dd>{DEMO_MEETING.speakers.join(", ")}</dd>
            </div>
            <div>
              <dt>Artifact</dt>
              <dd>
                {DEMO_MEETING.segmentCount} segments · <span className="mono">{DEMO_MEETING.contentSha256.slice(0, 12)}</span>
              </dd>
            </div>
          </dl>
          <form action="/api/desk/meeting" method="post">
            <button className="btn" type="submit">
              {step === MEETING_STEPS.length - 1 ? "Run the mock again" : "Advance the mock"}
            </button>
          </form>
        </div>
        <ol className="steps" aria-label="Recall lifecycle">
          {MEETING_STEPS.map((item, index) => (
            <li key={item.id} data-current={item.id === current.id ? "true" : undefined} data-done={index < step ? "true" : undefined}>
              <strong>{item.label}</strong>
              <p className="meta">{item.detail}</p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
