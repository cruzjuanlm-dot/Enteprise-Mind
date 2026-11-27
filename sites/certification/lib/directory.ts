import directoryFile from "../content/directory.json";
import { getTier } from "./catalog";
import { listCredentials } from "./verify";

export type DirectoryEntry = {
  id: string;
  name: string;
  tier: string;
  organization: string;
  practice: string;
  listing: string;
  credentialId: string | null;
};

export function getDirectory(): DirectoryEntry[] {
  return directoryFile.entries as DirectoryEntry[];
}

export function directoryIssues(): string[] {
  const issues: string[] = [];
  const credentials = listCredentials();
  for (const entry of getDirectory()) {
    if (!getTier(entry.tier)) {
      issues.push(`Directory entry ${entry.id} uses an unknown tier ${entry.tier}.`);
    }
    if (entry.credentialId) {
      const credential = credentials.find((item) => item.id === entry.credentialId);
      if (!credential) {
        issues.push(`Directory entry ${entry.id} links to missing credential ${entry.credentialId}.`);
      } else if (credential.status !== "active") {
        issues.push(`Directory entry ${entry.id} links to a credential that is not active.`);
      } else if (credential.tier !== entry.tier) {
        issues.push(`Directory entry ${entry.id} tier does not match ${entry.credentialId}.`);
      }
    }
  }
  return issues;
}
