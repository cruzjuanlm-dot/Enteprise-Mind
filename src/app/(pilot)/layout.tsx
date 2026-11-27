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
  const scope = tenant && membership ? `${tenant.name} · ${roleLabel(membership.role)}` : "Hearthline Instruments · Demo";
  const note =
    mode === "memory"
      ? "Demo session. Approved units last until this process restarts. No model is called."
      : null;

  return (
    <AppFrame showNav signedIn={Boolean(actor)} scope={scope} note={note}>
      <Suspense fallback={<LoadingRecords />}>
        <PendingNavigation>{children}</PendingNavigation>
      </Suspense>
    </AppFrame>
  );
}
