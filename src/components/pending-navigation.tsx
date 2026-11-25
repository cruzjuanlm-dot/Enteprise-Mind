"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { LoadingRecords } from "@/components/loading-records";

function routeKey(pathname: string, search: string) {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  params.sort();
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function isPlainLeftClick(event: MouseEvent) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export function PendingNavigation({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const here = routeKey(pathname, search);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    function remember(next: string) {
      const current = routeKey(window.location.pathname, window.location.search);
      if (next === current) return;
      setPendingHref(next);
    }

    function onClick(event: MouseEvent) {
      if (!isPlainLeftClick(event)) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest("a");
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.target && link.target !== "_self") return;
      if (link.hasAttribute("download")) return;
      const href = link.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      let url: URL;
      try {
        url = new URL(link.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      remember(routeKey(url.pathname, url.search));
    }

    function onPopState() {
      setPendingHref(routeKey(window.location.pathname, window.location.search));
    }

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  if (pendingHref && pendingHref !== here) return <LoadingRecords />;
  return children;
}
