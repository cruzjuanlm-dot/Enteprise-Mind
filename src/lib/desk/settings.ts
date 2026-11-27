import { subscriptionSnapshot } from "../admin/view";
import { isConfiguredSecret, isPublicSupabaseConfigured } from "../env";

export type DeskSettings = {
  dataMode: "memory" | "supabase";
  supabaseConfigured: boolean;
  extraction: "Rules reader";
  llmEnabled: false;
  recallConfigured: boolean;
  subscriptionActive: boolean;
  adminSecretConfigured: boolean;
  tokenPepperConfigured: boolean;
};

export function deskSettings(env: NodeJS.ProcessEnv = process.env): DeskSettings {
  const supabaseConfigured = isPublicSupabaseConfigured(env) && isConfiguredSecret(env.SUPABASE_SERVICE_ROLE_KEY);
  const forced = env.ENTERPRISE_MIND_DATA_MODE?.trim();
  const mode = forced === "supabase" || (forced !== "memory" && supabaseConfigured) ? "supabase" : "memory";
  return {
    dataMode: mode,
    supabaseConfigured,
    extraction: "Rules reader",
    llmEnabled: false,
    recallConfigured: isConfiguredSecret(env.RECALL_API_KEY) && isConfiguredSecret(env.RECALL_REGION),
    subscriptionActive: subscriptionSnapshot(env).active,
    adminSecretConfigured: isConfiguredSecret(env.FLUX_ADMIN_SECRET),
    tokenPepperConfigured: isConfiguredSecret(env.FLUX_TOKEN_PEPPER),
  };
}

export function deskNotice(code: string | undefined): { tone: "danger" | "warning" | "success" | "info"; text: string } | null {
  switch (code) {
    case "empty":
    case "empty_body":
      return { tone: "warning", text: "The transcript was empty, so nothing was compiled." };
    case "invalid_format":
      return { tone: "danger", text: "That file could not be read as text, WebVTT, or JSON turns." };
    case "too_large":
      return { tone: "danger", text: "That transcript is over the size limit and was not compiled." };
    case "denied":
      return { tone: "danger", text: "That text includes a name this catalog does not keep. Nothing was stored." };
    case "unlabeled":
      return { tone: "warning", text: "No labeled claim was found. The transcript was discarded and no unit was proposed." };
    case "invalid":
      return { tone: "danger", text: "A proposal needs a title, a type, and a body." };
    case "missing":
      return { tone: "danger", text: "That record is not in this demo session." };
    case "rejected":
      return { tone: "warning", text: "Rejected proposals stay out of the tree." };
    case "duplicate":
      return { tone: "info", text: "This transcript was already compiled. Existing proposals are unchanged." };
    case "compiled":
      return { tone: "success", text: "Labeled claims are proposed below. The transcript was discarded." };
    case "approved":
      return { tone: "success", text: "Approved. The unit is in the knowledge tree. Nothing was executed." };
    case "saved":
      return { tone: "success", text: "Edits saved. The unit stays proposed until you approve it." };
    case "promoted":
      return { tone: "success", text: "Scope is company. The file stays in the project folder." };
    case "revised":
      return { tone: "success", text: "The session unit was updated." };
    default:
      return null;
  }
}
