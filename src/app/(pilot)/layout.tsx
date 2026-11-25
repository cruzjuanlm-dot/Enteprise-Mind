import { Suspense } from "react";
import { AppFrame } from "@/components/app-frame";
import { LoadingRecords } from "@/components/loading-records";
import { PendingNavigation } from "@/components/pending-navigation";
import { roleLabel } from "@/lib/present";
import { getContext } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PilotLayout({ children }: Readonly<{ children: React.ReactNode }>) {
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
    <AppFrame showNav={Boolean(actor)} scope={scope} note={note}>
      <Suspense fallback={<LoadingRecords />}>
        <PendingNavigation>{children}</PendingNavigation>
      </Suspense>
    </AppFrame>
  );
}
