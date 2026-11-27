"use server";

import { redirect } from "next/navigation";
import { normalizeCredentialId } from "@/lib/verify";

export async function checkCredential(formData: FormData) {
  const raw = String(formData.get("id") ?? "").trim();
  if (!raw) redirect("/verify");
  const id = normalizeCredentialId(raw).slice(0, 64);
  redirect(`/verify/${encodeURIComponent(id)}`);
}
