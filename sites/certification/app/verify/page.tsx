import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { VerifyScreen } from "@/components/verify-screen";
import { lookupCredential } from "@/lib/verify";

export const metadata: Metadata = {
  title: "Verify",
};

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const params = await searchParams;
  if (typeof params.id === "string" && params.id.trim() !== "") {
    redirect(`/verify/${encodeURIComponent(params.id.trim())}`);
  }
  return <VerifyScreen result={lookupCredential("")} />;
}
