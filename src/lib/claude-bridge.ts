import { spawn, type ChildProcess } from "child_process";
import type { AgentCliProvider, PermissionMode } from "@/types/chat";
import { PATHS } from "@/config/paths-config";

const CWD = process.cwd();
const VAULT = PATHS.obsidianVault;

export interface ClaudeBridgeOptions {
  prompt: string;
  sessionId?: string | null;
  permissionMode?: PermissionMode;
  model?: string;
  provider?: AgentCliProvider;
  appendSystemPrompt?: string;
  extraContextDirs?: string[];
}

function getAgentCliProvider(requestedProvider?: AgentCliProvider): AgentCliProvider {
  if (requestedProvider) return requestedProvider;

  const provider = (
    process.env.AGENT_CLI_PROVIDER ??
    process.env.LLM_PROVIDER ??
    "claude"
  ).toLowerCase();

  return provider === "codex" ? "codex" : "claude";
}

function mapCodexModel(model?: string): string | undefined {
  if (!model) return process.env.CODEX_MODEL;

  if (model === "opus") return process.env.CODEX_MODEL_OPUS ?? process.env.CODEX_MODEL;
  if (model === "sonnet") return process.env.CODEX_MODEL_SONNET ?? process.env.CODEX_MODEL;
  if (model === "haiku") return process.env.CODEX_MODEL_HAIKU ?? process.env.CODEX_MODEL;

  return model;
}

function buildClaudeArgs(options: ClaudeBridgeOptions): string[] {
  const args = [
    "--print",
    "--verbose",
    "--output-format",
    "stream-json",
    "--permission-mode",
    options.permissionMode ?? "acceptEdits",
  ];

  if (options.model) {
    args.push("--model", options.model);
  }

  if (options.sessionId) {
    args.push("--resume", options.sessionId);
  }

  if (options.appendSystemPrompt) {
    args.push("--append-system-prompt", options.appendSystemPrompt);
  }

  args.push("--add-dir", VAULT);

  if (options.extraContextDirs) {
    for (const dir of options.extraContextDirs) {
      if (dir !== VAULT) {
        args.push("--add-dir", dir);
      }
    }
  }

  args.push("--", options.prompt);
  return args;
}

function buildCodexArgs(options: ClaudeBridgeOptions): string[] {
  const args = ["exec", "--skip-git-repo-check", "--json", "-C", CWD];
  const model = mapCodexModel(options.model);
  const prompt =
    options.appendSystemPrompt
      ? `${options.appendSystemPrompt}\n\nUser request:\n${options.prompt}`
      : options.prompt;

  if (model) {
    args.push("--model", model);
  }

  if (options.permissionMode === "bypassPermissions") {
    args.push("--dangerously-bypass-approvals-and-sandbox");
  } else {
    args.push("--sandbox", "workspace-write");
  }

  args.push("--add-dir", VAULT);

  if (options.extraContextDirs) {
    for (const dir of options.extraContextDirs) {
      if (dir !== VAULT) {
        args.push("--add-dir", dir);
      }
    }
  }

  if (options.sessionId) {
    args.push("resume", options.sessionId, prompt);
  } else {
    args.push(prompt);
  }

  return args;
}

export function spawnClaude(options: ClaudeBridgeOptions): ChildProcess {
  const provider = getAgentCliProvider(options.provider);
  const command = provider === "codex" ? "codex" : "claude";
  const args = provider === "codex" ? buildCodexArgs(options) : buildClaudeArgs(options);

  return spawn(command, args, {
    cwd: CWD,
    env: { ...process.env },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export async function checkClaudeHealth(provider?: AgentCliProvider): Promise<boolean> {
  const selectedProvider = getAgentCliProvider(provider);
  const command = selectedProvider === "codex" ? "codex" : "claude";

  return new Promise((resolve) => {
    const proc = spawn(command, ["--version"], { stdio: "pipe" });
    proc.on("close", (code) => resolve(code === 0));
    proc.on("error", () => resolve(false));
    setTimeout(() => {
      proc.kill();
      resolve(false);
    }, 5000);
  });
}
