import Link from "next/link";

export default function CatalogLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="mx-auto min-h-screen max-w-5xl px-5 py-6">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
        <div>
          <Link href="/" className="text-3xl font-semibold tracking-tight">
            Enterprise Mind
          </Link>
          <p className="text-sm text-[var(--text-muted)]">Knowledge catalog</p>
        </div>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <Link href="/catalog">Catalog</Link>
          <Link href="/entities">Entities</Link>
          <Link href="/">Home</Link>
        </nav>
      </header>
      {children}
    </div>
  );
}
