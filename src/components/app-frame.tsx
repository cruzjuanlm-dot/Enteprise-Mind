"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

const PRIMARY = [
  { href: "/", label: "Knowledge" },
  { href: "/search", label: "Search" },
  { href: "/compile", label: "Compile" },
  { href: "/proposals", label: "Proposals" },
  { href: "/meetings", label: "Meetings" },
  { href: "/entities", label: "Entities" },
  { href: "/admin", label: "Admin" },
];

const PILOT = [
  { href: "/review", label: "Review queue" },
  { href: "/ingest", label: "Submit transcript" },
  { href: "/departments", label: "Departments" },
  { href: "/jobs", label: "Jobs" },
  { href: "/tokens", label: "Tokens" },
  { href: "/catalog", label: "Catalog" },
];

export function AppFrame({
  showNav,
  signedIn = false,
  scope,
  note,
  children,
}: {
  showNav: boolean;
  signedIn?: boolean;
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

  const navigation = showNav && pathname !== "/login";

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
          {navigation ? (
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
          ) : null}
          {!signedIn && pathname !== "/login" ? (
            <Link className="btn secondary" href="/login">
              Sign in
            </Link>
          ) : null}
          {signedIn ? (
            <form action="/api/auth/logout" method="post" inert={open ? true : undefined}>
              <button className="btn secondary" type="submit">
                Sign out
              </button>
            </form>
          ) : null}
        </div>
      </header>
      <div className="app-body">
        {navigation ? (
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
                Knowledge
              </p>
              <ul>
                {PRIMARY.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} aria-current={currentLink(pathname, link.href) ? "page" : undefined}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="nav-label">Pilot</p>
              <ul>
                {PILOT.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} aria-current={currentLink(pathname, link.href) ? "page" : undefined}>
                      {link.label}
                    </Link>
                  </li>
                ))}
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

function currentLink(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function drawerItems(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>("button[data-drawer-focus], [data-drawer-focus] a")];
}
