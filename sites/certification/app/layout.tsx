import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PrototypeBanner } from "@/components/prototype-banner";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const sans = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Flux certification",
    template: "%s · Flux certification",
  },
  description:
    "Draft prototype of the Flux standard, its courses, and its certifications. Fictional data.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${mono.variable}`}>
        <a className="skip" href="#content">
          Skip to content
        </a>
        <PrototypeBanner />
        <SiteHeader />
        <main id="content">
          <div className="frame stack">{children}</div>
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
