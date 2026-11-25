import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppFrame } from "@/components/app-frame";
import { roleLabel } from "@/lib/present";
import { getContext } from "@/lib/session";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Enterprise Mind",
  description: "Review proposed decisions and tasks before they become shared context.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { actor, mode, repo } = await getContext();
  const membership = actor?.memberships[0];
  const tenant = membership ? await repo.getTenant(membership.tenantId) : null;
  const scope = tenant && membership ? `${tenant.name} · ${roleLabel(membership.role)}` : "Transcript review";
  const note =
    mode === "memory"
      ? actor
        ? "Demo fixture session. Records last until this process restarts."
        : "Supabase is not connected."
      : null;

  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <AppFrame showNav={Boolean(actor)} scope={scope} note={note}>
          {children}
        </AppFrame>
      </body>
    </html>
  );
}
