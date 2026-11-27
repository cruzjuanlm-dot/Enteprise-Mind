"use client";

import { useFormStatus } from "react-dom";

export function CheckButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="button" aria-busy={pending} disabled={pending}>
      {pending ? "Checking the register" : "Check the register"}
    </button>
  );
}
