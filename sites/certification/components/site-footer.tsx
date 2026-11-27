import Link from "next/link";
import { formatUtcStamp } from "@/lib/dates";
import { site } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="frame footer-bar">
        <nav className="footer-nav" aria-label="Footer">
          <Link href="/governance">Governance</Link>
          <Link href="/partners">Partners</Link>
        </nav>
        <p className="footer-meta">
          <Link href="/standard">Flux Standard v{site.version}</Link>
          {" · "}
          {site.status}
          {" · Updated "}
          {formatUtcStamp(site.updated)}
        </p>
      </div>
    </footer>
  );
}
