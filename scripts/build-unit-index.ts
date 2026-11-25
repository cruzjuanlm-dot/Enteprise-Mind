import { validateRepository } from "../src/lib/validate-content";
import { writeUnitIndex } from "../src/lib/unit-index";

const root = process.cwd();
const units = writeUnitIndex(root);
const issues = validateRepository(root);
if (issues.length > 0) {
  for (const issue of issues) console.error(`${issue.file}: ${issue.message}`);
  process.exit(1);
}

console.log(`Wrote INDEX.md and _control/ledgers/unit-index.json (${units.length} units).`);
