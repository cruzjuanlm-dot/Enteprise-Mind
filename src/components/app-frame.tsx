"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

const LINKS = [
  { href: "/review", label: "Review queue" },
  { href: "/ingest", label: "Submit transcript" },
  { href: "/departments", label: "Departments" },
  { href: "/jobs", label: "Jobs" },
];

export function AppFrame({
  showNav,
  scope,
  note,
  children,
}: {
  showNav: boolean;
  scope: string;
  note: string | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const wasOpen = useRef(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const labelId = useId();

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 1199px)").matches;
    if (mobile && wasOpen.current) document.getElementById("main")?.focus();
    wasOpen.current = false;
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    wasOpen.current = true;
    const media = window.matchMedia("(max-width: 1199px)");
    if (!media.matches) return;
    const items = drawerItems();
    items.find((item) => item.tagName === "A")?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        wasOpen.current = false;
        toggleRef.current?.focus();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = drawerItems();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <div className="app">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <div className="brand" inert={open ? true : undefined}>
          <Link href="/" className="brand-name">
            Enterprise Mind
          </Link>
          <p className="meta">{scope}</p>
          {note ? <p className="meta">{note}</p> : null}
        </div>
        <div className="top-actions">
          {showNav ? (
            <button
              ref={toggleRef}
              className="nav-toggle btn secondary"
              type="button"
              data-drawer-focus="true"
              aria-expanded={open}
              aria-controls="app-nav"
              onClick={() => setOpen((value) => !value)}
            >
              {open ? "Close menu" : "Menu"}
            </button>
          ) : pathname === "/login" ? null : (
            <Link className="btn secondary" href="/login">
              Sign in
            </Link>
          )}
          {showNav ? (
            <form action="/api/auth/logout" method="post" inert={open ? true : undefined}>
              <button className="btn secondary" type="submit">
                Sign out
              </button>
            </form>
          ) : null}
        </div>
      </header>
      <div className="app-body">
        {showNav ? (
          <>
            {open ? (
              <button
                className="nav-backdrop"
                type="button"
                data-drawer-focus="true"
                aria-label="Close menu"
                onClick={() => {
                  setOpen(false);
                  wasOpen.current = false;
                  toggleRef.current?.focus();
                }}
              />
            ) : null}
            <nav id="app-nav" className="nav" aria-labelledby={labelId} data-open={open ? "true" : "false"} data-drawer-focus="true">
              <p id={labelId} className="nav-label">
                Workspace
              </p>
              <ul>
                {LINKS.map((link) => {
                  const current = pathname === link.href || pathname.startsWith(`${link.href}/`);
                  return (
                    <li key={link.href}>
                      <Link href={link.href} aria-current={current ? "page" : undefined}>
                        {link.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </>
        ) : null}
        <div id="main" className="work" tabIndex={-1} inert={open ? true : undefined}>
          {children}
        </div>
      </div>
    </div>
  );
}

function drawerItems(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>("button[data-drawer-focus], [data-drawer-focus] a")];
}
