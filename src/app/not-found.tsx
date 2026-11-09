import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page">
      <h1>That record is not available</h1>
      <p className="lede">It may sit outside this account, or the address may be wrong.</p>
      <p>
        <Link href="/">Back to the desk</Link>
      </p>
    </div>
  );
}
