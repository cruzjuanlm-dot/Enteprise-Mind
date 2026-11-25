import { validateRepository } from "../src/lib/validate-content";
import { writeUnitIndex } from "../src/lib/unit-index";

const root = process.cwd();
const issues = validateRepository(root);
if (issues.length > 0) {
  for (const issue of issues) console.error(`${issue.file}: ${issue.message}`);
  process.exit(1);
}

const units = writeUnitIndex(root);
console.log(`Wrote units/index.json (${units.length} units).`);
