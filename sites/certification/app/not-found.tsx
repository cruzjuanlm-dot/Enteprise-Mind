import Link from "next/link";

export default function NotFound() {
  return (
    <>
      <header className="page-header">
        <p className="kicker">Missing page</p>
        <h1>This page is not in the prototype</h1>
        <p className="lede">The address does not match a page on this site.</p>
      </header>
      <p className="inline-links">
        <Link href="/">Home</Link>
        <Link href="/courses">Courses</Link>
        <Link href="/verify">Verify</Link>
      </p>
    </>
  );
}
