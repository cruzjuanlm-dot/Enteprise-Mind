import { validateRepository } from "../src/lib/validate-content";

const issues = validateRepository(process.cwd());
if (issues.length === 0) {
  console.log("Units, compositions, and seed entities are valid.");
  process.exit(0);
}

for (const issue of issues) console.error(`${issue.file}: ${issue.message}`);
process.exit(1);
