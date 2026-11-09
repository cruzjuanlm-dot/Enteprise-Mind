import type { Metadata } from "next";
import Link from "next/link";
import { getContext } from "@/lib/session";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Enterprise Mind",
  description: "Review proposed decisions and tasks before they are trusted.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { actor } = await getContext();
  return (
    <html lang="en">
      <body>
        <div className="mx-auto min-h-screen max-w-5xl px-5 py-6">
          <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--line)] pb-4">
            <div>
              <Link href="/" className="serif text-3xl tracking-tight">
                Enterprise Mind
              </Link>
              <p className="text-sm text-[var(--muted)]">Pilot review loop</p>
            </div>
            <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              {actor ? (
                <>
                  <Link href="/review">Review</Link>
                  <Link href="/ingest">Ingest</Link>
                  <Link href="/departments">Departments</Link>
                  <Link href="/jobs">Jobs</Link>
                  <form action="/api/auth/logout" method="post">
                    <button className="btn secondary" type="submit">
                      Sign out
                    </button>
                  </form>
                </>
              ) : (
                <Link className="btn" href="/login">
                  Sign in
                </Link>
              )}
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
