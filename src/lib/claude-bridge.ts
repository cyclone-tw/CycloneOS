import { spawn, type ChildProcess } from "child_process";
import type { PermissionMode } from "@/types/chat";

const CWD = "/Users/username/CycloneOpenClaw";
const VAULT =
  "/Users/username/Library/CloudStorage/GoogleDrive-user@gmail.com/我的雲端硬碟/Obsidian-Cyclone";

export interface ClaudeBridgeOptions {
  prompt: string;
  sessionId?: string | null;
  permissionMode?: PermissionMode;
  model?: string;
  appendSystemPrompt?: string;
  extraContextDirs?: string[];
}

export function spawnClaude(options: ClaudeBridgeOptions): ChildProcess {
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

  // Default vault dir
  args.push("--add-dir", VAULT);

  // Extra context directories (agent-specific)
  if (options.extraContextDirs) {
    for (const dir of options.extraContextDirs) {
      if (dir !== VAULT) {
        args.push("--add-dir", dir);
      }
    }
  }

  args.push("--", options.prompt);

  return spawn("claude", args, {
    cwd: CWD,
    env: { ...process.env },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export async function checkClaudeHealth(): Promise<boolean> {
  const { getLLMProvider } = await import("./llm-provider");
  return getLLMProvider().healthCheck();
}
