import { checkClaudeHealth } from "@/lib/claude-bridge";

export const dynamic = "force-dynamic";

export async function GET() {
  const claudeOk = await checkClaudeHealth();
  return Response.json({
    status: claudeOk ? "ok" : "degraded",
    claude: claudeOk,
    timestamp: new Date().toISOString(),
  });
}
