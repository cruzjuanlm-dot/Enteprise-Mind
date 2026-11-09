"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function RefreshWhilePending({ pending }: { pending: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!pending) return;
    const timer = window.setInterval(() => router.refresh(), 1500);
    return () => window.clearInterval(timer);
  }, [pending, router]);
  return null;
}
