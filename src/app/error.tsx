"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="page" role="alert">
      <h1>This page could not be loaded</h1>
      <p className="lede">Nothing was changed. Retry this view.</p>
      <button className="btn secondary" type="button" onClick={() => reset()}>
        Retry
      </button>
    </div>
  );
}
