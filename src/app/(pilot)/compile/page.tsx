import Link from "next/link";
import { PendingForm } from "@/components/pending-form";
import { KILNWATCH_SAMPLE, KILNWATCH_SAMPLE_TITLE } from "@/lib/desk/sample";
import { deskNotice } from "@/lib/desk/settings";

export const dynamic = "force-dynamic";

export default async function CompilePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const notice = deskNotice(params.error);

  return (
    <main className="page">
      <header className="page-head">
        <div>
          <h1>Compile a transcript</h1>
          <p className="lede">
            Paste labeled text or upload a .txt, .vtt, or .json file. The rules reader proposes a unit for each Decision,
            Task, Architecture, Risk, Open question, or Term. The transcript is discarded. Unlabeled speech is not kept.
          </p>
        </div>
      </header>
      {notice ? (
        <p className="notice" data-tone={notice.tone === "info" ? undefined : notice.tone} role={notice.tone === "danger" ? "alert" : "status"}>
          {notice.text}
        </p>
      ) : null}
      <section className="panel stack-tight measure">
        <h2>What the reader understands</h2>
        <p>
          Start a block with the label and a colon. Optional lines are Owner, Dependencies, Systems, Acceptance, Due,
          Approval, and Details. Anything not stated stays unknown. No model is called.
        </p>
      </section>
      <PendingForm action="/api/desk/compile" className="stack measure" encType="multipart/form-data">
        <label className="field">
          <span className="label">Title</span>
          <input name="title" defaultValue={KILNWATCH_SAMPLE_TITLE} autoComplete="off" />
          <span className="help">A label for this compile. It is not stored as a transcript.</span>
        </label>
        <label className="field">
          <span className="label">Transcript</span>
          <textarea name="content" rows={16} defaultValue={KILNWATCH_SAMPLE} />
        </label>
        <label className="field">
          <span className="label">Or upload a file</span>
          <input name="file" type="file" accept=".txt,.vtt,.json,text/plain,application/json" />
          <span className="help">A file replaces the text above. WebVTT and JSON turns are read, then dropped.</span>
        </label>
        <button className="btn" type="submit">
          <span className="idle-label">Compile</span>
          <span className="busy-label">Compiling</span>
        </button>
      </PendingForm>
      <p className="meta">
        The pilot queue at <Link href="/ingest">Submit transcript</Link> is a separate path. This page is the catalog compile.
      </p>
    </main>
  );
}
