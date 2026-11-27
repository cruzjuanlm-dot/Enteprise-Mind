import type { Metadata } from "next";
import { Geist_Mono, Source_Sans_3, Source_Serif_4 } from "next/font/google";
import { PrototypeBanner } from "@/components/prototype-banner";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const serif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-serif",
  display: "swap",
});

const ui = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ui",
  display: "swap",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
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
      <body className={`${serif.variable} ${ui.variable} ${mono.variable}`}>
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
