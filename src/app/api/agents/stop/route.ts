import { NextRequest } from "next/server";
import { agentManager } from "@/lib/agent-manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { processId } = body;

  if (!processId) {
    return Response.json({ error: "Missing processId" }, { status: 400 });
  }

  const success = agentManager.stop(processId);
  return Response.json({ success });
}
