import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { unitPins } from "../src/lib/unit-pin";
import { collectUnits } from "../src/lib/unit-index";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
const placeholder = /placeholder|your-project|example\.supabase|changeme|xxxxx/i;
if (!url || !key || placeholder.test(`${url} ${key}`)) {
  console.log("Supabase is not configured. Unit commit pins were not written.");
  process.exit(0);
}

const sha = (process.env.GITHUB_SHA?.trim() || execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" })).trim();
let changed: string[] = [];
try {
  changed = execFileSync("git", ["diff-tree", "--no-commit-id", "--name-only", "-r", sha], { encoding: "utf8" })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
} catch {
  changed = [];
}

const pins = unitPins(collectUnits(process.cwd()), changed, sha);
if (pins.length === 0) {
  console.log("No unit files changed in this commit.");
  process.exit(0);
}

const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
for (const pin of pins) {
  const { error } = await client.from("unit_refs").update({ commit_sha: pin.commit_sha, unit_path: pin.unit_path }).eq("id", pin.id);
  if (error) {
    console.error(`${pin.id}: ${error.message}`);
    process.exit(1);
  }
}
console.log(`Pinned ${pins.length} unit refs at ${sha}.`);
