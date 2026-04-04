import { checkClaudeHealth } from "@/lib/claude-bridge";
import type { AgentCliProvider } from "@/types/chat";

export const dynamic = "force-dynamic";

export async function GET() {
  const defaultProvider = (
    process.env.AGENT_CLI_PROVIDER ??
    process.env.LLM_PROVIDER ??
    "claude"
  ).toLowerCase() as AgentCliProvider;
  const [claudeOk, codexOk] = await Promise.all([
    checkClaudeHealth("claude"),
    checkClaudeHealth("codex"),
  ]);
  const providers = {
    claude: claudeOk,
    codex: codexOk,
  };
  const cliOk = providers[defaultProvider] ?? false;

  return Response.json({
    status: cliOk ? "ok" : "degraded",
    provider: defaultProvider,
    cli: cliOk,
    providers,
    timestamp: new Date().toISOString(),
  });
}
