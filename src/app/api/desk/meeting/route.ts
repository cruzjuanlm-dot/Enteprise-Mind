import { advanceDeskMeeting } from "@/lib/desk/store";
import { redirectTo } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  advanceDeskMeeting();
  return redirectTo(request, "/meetings");
}
