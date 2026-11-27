import type { Metadata } from "next";
import { DirectoryList, type DirectoryRow } from "@/components/directory-list";
import { PageHeader } from "@/components/page-header";
import { getTier } from "@/lib/catalog";
import { directoryIssues, getDirectory } from "@/lib/directory";

export const metadata: Metadata = {
  title: "Directory",
};

export default function DirectoryPage() {
  const issues = directoryIssues();
  if (issues.length > 0) throw new Error(issues.join("\n"));
  const entries: DirectoryRow[] = getDirectory().map((entry) => ({
    id: entry.id,
    name: entry.name,
    tierName: getTier(entry.tier)?.name ?? entry.tier,
    organization: entry.organization,
    practice: entry.practice,
    listing: entry.listing,
    credentialId: entry.credentialId,
  }));
  return (
    <>
      <PageHeader
        kicker="Opted in"
        title="Directory"
        lede="A stub. Certified practitioners and licensed trainers who asked to be listed. Fictional. A row with a credential id links to Verify. Expired and revoked marks are not listed."
      />
      <DirectoryList entries={entries} />
    </>
  );
}
