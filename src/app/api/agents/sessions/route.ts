import { sessionStore } from "@/lib/session-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sessions = sessionStore.listSessions();
  return Response.json({ sessions });
}
