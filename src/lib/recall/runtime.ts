import { after } from "next/server";
import type { RecallDeps } from "./deps";
import { recallStoreForEnv } from "./store";

export function liveRecallDeps(): RecallDeps {
  return {
    env: process.env,
    fetch: globalThis.fetch,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: () => Date.now(),
    store: recallStoreForEnv(process.env),
    root: process.cwd(),
    schedule(work) {
      const run = () => {
        work().catch((error: unknown) => {
          console.error(JSON.stringify({ event: "recall_job_failed", name: error instanceof Error ? error.name : "error" }));
        });
      };
      try {
        after(run);
      } catch {
        setImmediate(run);
      }
    },
  };
}
