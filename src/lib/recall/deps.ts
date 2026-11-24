import type { RecallStore } from "./store";

export type RecallDeps = {
  env: NodeJS.ProcessEnv;
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  store: RecallStore;
  root: string;
  schedule: (work: () => Promise<void>) => void;
};
