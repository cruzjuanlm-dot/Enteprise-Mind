"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";

export function PendingForm({
  action,
  children,
  className,
}: {
  action: string;
  children: ReactNode;
  className?: string;
}) {
  const [pending, setPending] = useState(false);
  const lock = useRef(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (lock.current) {
      event.preventDefault();
      return;
    }
    lock.current = true;
    setPending(true);
  }

  return (
    <form action={action} method="post" className={className} onSubmit={onSubmit} aria-busy={pending || undefined}>
      {children}
    </form>
  );
}
