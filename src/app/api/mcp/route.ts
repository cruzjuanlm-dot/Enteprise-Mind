import { handleMcp } from "@/lib/mcp/handle";
import { recallStoreForEnv } from "@/lib/recall/store";
import { tokenStoreForEnv } from "@/lib/tokens/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function respond(request: Request) {
  return handleMcp(request, {
    env: process.env,
    store: tokenStoreForEnv(),
    now: () => Date.now(),
    root: process.cwd(),
    fetch: globalThis.fetch,
    recallStore: recallStoreForEnv(process.env),
    recall: {
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      schedule(work) {
        work().catch((error: unknown) => {
          console.error(JSON.stringify({ event: "mcp_bot_failed", name: error instanceof Error ? error.name : "error" }));
        });
      },
    },
  });
}

export function GET(request: Request) {
  return respond(request);
}

export function POST(request: Request) {
  return respond(request);
}

export function DELETE(request: Request) {
  return respond(request);
}
