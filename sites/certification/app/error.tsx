"use client";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="state state-error" role="alert">
      <h1>This page did not finish</h1>
      <p>The prototype hit an error while rendering. Nothing was saved.</p>
      <button type="button" className="button" onClick={() => reset()}>
        Try again
      </button>
    </div>
  );
}
