"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { primaryNav } from "@/lib/site";

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function current(href: string): boolean {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function toggle() {
    setOpen((value) => {
      const next = !value;
      requestAnimationFrame(() => {
        if (next) firstLinkRef.current?.focus();
        else buttonRef.current?.focus();
      });
      return next;
    });
  }

  return (
    <header className="site-header">
      <div className="frame header-bar">
        <Link href="/" className="wordmark">
          <span className="wordmark-name">Flux</span>
          <span className="wordmark-meta">Certification · Draft</span>
        </Link>
        <button
          ref={buttonRef}
          type="button"
          className="menu-button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={toggle}
        >
          {open ? "Close" : "Menu"}
        </button>
        <nav id={panelId} className={open ? "site-nav open" : "site-nav"} aria-label="Primary">
          {primaryNav.map((link, index) => (
            <Link
              key={link.href}
              href={link.href}
              ref={index === 0 ? firstLinkRef : undefined}
              aria-current={current(link.href) ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
