import type { Metadata } from "next";
import { VerifyScreen } from "@/components/verify-screen";
import { listCredentials, lookupCredential } from "@/lib/verify";

type Params = { id: string };

export function generateStaticParams() {
  return listCredentials().map((credential) => ({ id: credential.id }));
}

export const dynamicParams = true;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const result = lookupCredential(id);
  if (result.kind === "found") return { title: result.credential.id };
  if (result.kind === "unknown") return { title: "Unknown credential" };
  return { title: "Credential lookup" };
}

export default async function CredentialPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  return <VerifyScreen result={lookupCredential(id)} />;
}
