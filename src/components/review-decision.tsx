"use client";

import { useRef, useState, type FormEvent } from "react";

export function ReviewDecision({ unitId }: { unitId: string }) {
  const lock = useRef(false);
  const [pending, setPending] = useState<"accept" | "reject" | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (lock.current) {
      event.preventDefault();
      return;
    }
    lock.current = true;
    const form = event.currentTarget;
    const action = new FormData(form).get("action") === "reject" ? "reject" : "accept";
    setPending(action);
    const group = form.closest("[data-review-decision]");
    group?.querySelectorAll<HTMLButtonElement>("button[type='submit']").forEach((button) => {
      if (button.form !== form) button.disabled = true;
    });
    queueMicrotask(() => {
      group?.querySelectorAll<HTMLButtonElement>("button[type='submit']").forEach((button) => {
        button.disabled = true;
      });
    });
  }

  return (
    <div className="cluster" data-review-decision="">
      <form action="/api/review" method="post" onSubmit={onSubmit} aria-busy={pending === "accept" || undefined}>
        <input type="hidden" name="unitId" value={unitId} />
        <input type="hidden" name="action" value="accept" />
        <button className="btn" type="submit" disabled={pending !== null}>
          <span className="idle-label">Accept</span>
          <span className="busy-label">Accepting</span>
        </button>
      </form>
      <form action="/api/review" method="post" onSubmit={onSubmit} aria-busy={pending === "reject" || undefined}>
        <input type="hidden" name="unitId" value={unitId} />
        <input type="hidden" name="action" value="reject" />
        <button className="btn danger" type="submit" disabled={pending !== null}>
          <span className="idle-label">Reject</span>
          <span className="busy-label">Rejecting</span>
        </button>
      </form>
    </div>
  );
}
