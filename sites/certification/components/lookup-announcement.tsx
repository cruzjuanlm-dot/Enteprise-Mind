"use client";

import { useEffect, useRef } from "react";

export function LookupAnnouncement({
  message,
  children,
}: {
  message: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const heading = ref.current?.querySelector("h2");
    if (!(heading instanceof HTMLElement)) return;
    heading.tabIndex = -1;
    heading.focus();
  }, [message]);

  return (
    <div ref={ref} role="status" aria-live="polite" aria-atomic="true">
      <p className="sr-only">{message}</p>
      {children}
    </div>
  );
}
