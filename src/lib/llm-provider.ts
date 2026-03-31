// dashboard/src/lib/llm-provider.ts
//
// LLM Provider abstraction layer.
// Default: ClaudeCLIProvider (spawns Claude CLI).
// Future: AnthropicSDKProvider, OpenAIProvider, etc.

import { spawn, type ChildProcess } from "child_process";

// --- Types ---

export interface LLMStreamEvent {
  type: "session" | "text" | "error" | "done";
  sessionId?: string;
  text?: string;
  error?: string;
}

export interface LLMRequestOptions {
  prompt: string;
  model?: string;
  sessionId?: string;
  /** Send prompt via stdin instead of CLI arg (needed for long prompts) */
  stdinPrompt?: boolean;
  /** Disable MCP servers and setting sources */
  noMcp?: boolean;
  /** Don't add vault directory to context */
  noVault?: boolean;
  /** Permission mode for Claude CLI */
  permissionMode?: string;
  /** Tools to disallow */
  disallowedTools?: string[];
  /** System prompt to append */
  appendSystemPrompt?: string;
  /** Extra context directories */
  extraContextDirs?: string[];
}

export interface LLMProvider {
  stream(options: LLMRequestOptions): AsyncIterable<LLMStreamEvent>;
  healthCheck(): Promise<boolean>;
}

// --- Claude CLI Provider ---

const CWD = "/Users/username/CycloneOpenClaw";
const VAULT =
  "/Users/username/Library/CloudStorage/GoogleDrive-user@gmail.com/我的雲端硬碟/Obsidian-Cyclone";

export class ClaudeCLIProvider implements LLMProvider {
  async *stream(options: LLMRequestOptions): AsyncGenerator<LLMStreamEvent> {
    const args = this.buildArgs(options);
    const useStdin = options.stdinPrompt ?? false;

    if (!useStdin) {
      args.push("--", options.prompt);
    }

    const child = spawn("claude", args, {
      cwd: CWD,
      env: { ...process.env },
      stdio: [useStdin ? "pipe" : "ignore", "pipe", "pipe"],
    });

    if (useStdin && child.stdin) {
      child.stdin.write(options.prompt);
      child.stdin.end();
    }

    yield* this.parseStream(child);
  }

  async healthCheck(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn("claude", ["--version"], { stdio: "pipe" });
      proc.on("close", (code) => resolve(code === 0));
      proc.on("error", () => resolve(false));
      setTimeout(() => {
        proc.kill();
        resolve(false);
      }, 5000);
    });
  }

  private buildArgs(options: LLMRequestOptions): string[] {
    const args = ["--print", "--verbose", "--output-format", "stream-json"];

    if (options.permissionMode) {
      args.push("--permission-mode", options.permissionMode);
    }

    if (options.model) {
      args.push("--model", options.model);
    }

    if (options.sessionId) {
      args.push("--resume", options.sessionId);
    }

    if (options.appendSystemPrompt) {
      args.push("--append-system-prompt", options.appendSystemPrompt);
    }

    if (options.disallowedTools?.length) {
      args.push("--disallowed-tools", options.disallowedTools.join(","));
    }

    if (options.noMcp) {
      args.push("--strict-mcp-config", "--setting-sources", "");
    }

    if (!options.noVault) {
      args.push("--add-dir", VAULT);
    }

    if (options.extraContextDirs) {
      for (const dir of options.extraContextDirs) {
        if (dir !== VAULT) {
          args.push("--add-dir", dir);
        }
      }
    }

    return args;
  }

  /**
   * Parse Claude CLI stream-json output into LLMStreamEvents.
   *
   * Real event sequence (Claude CLI v2.1.87, --output-format stream-json):
   *   1. system (subtype: init)  → session_id
   *   2. assistant               → message.content[] with thinking block
   *   3. assistant               → message.content[] with text block (full text)
   *   4. rate_limit_event
   *   5. result                  → session_id, result (full text), cost
   *
   * NOTE: No content_block_delta events exist in this format.
   * Each assistant event carries exactly one content block.
   */
  private async *parseStream(child: ChildProcess): AsyncGenerator<LLMStreamEvent> {
    const queue: Array<LLMStreamEvent | null> = [];
    let waiting: (() => void) | null = null;
    let done = false;

    const push = (event: LLMStreamEvent | null) => {
      queue.push(event);
      if (waiting) {
        waiting();
        waiting = null;
      }
    };

    let lineBuffer = "";

    const processLine = (line: string) => {
      if (!line.trim()) return;
      try {
        const parsed = JSON.parse(line);

        // Session ID from system/init event
        if (parsed.type === "system" && parsed.subtype === "init" && parsed.session_id) {
          push({ type: "session", sessionId: parsed.session_id });
        }

        // Text from assistant events — each event contains one content block
        if (parsed.type === "assistant") {
          const content = parsed.message?.content;
          if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type === "text" && block.text) {
                push({ type: "text", text: block.text });
              }
            }
          }
        }

        // Session ID from result event (backup)
        if (parsed.type === "result" && parsed.session_id) {
          push({ type: "session", sessionId: parsed.session_id });
        }
      } catch {
        // Not valid JSON, skip
      }
    };

    child.stdout!.on("data", (chunk: Buffer) => {
      lineBuffer += chunk.toString();
      const lines = lineBuffer.split("\n");
      lineBuffer = lines.pop() ?? "";
      for (const line of lines) processLine(line);
    });

    child.stderr!.on("data", (chunk: Buffer) => {
      const msg = chunk.toString().trim();
      if (msg) push({ type: "error", error: msg });
    });

    child.on("close", (code) => {
      if (lineBuffer.trim()) processLine(lineBuffer);
      if (code !== 0) {
        push({ type: "error", error: `Claude exited with code ${code}` });
      }
      push({ type: "done" });
      push(null); // sentinel to end iteration
      done = true;
    });

    child.on("error", (err) => {
      push({ type: "error", error: `Failed to start claude: ${err.message}` });
      push(null);
      done = true;
    });

    // Yield events from queue
    while (true) {
      if (queue.length > 0) {
        const event = queue.shift()!;
        if (event === null) return;
        yield event;
      } else if (done) {
        return;
      } else {
        await new Promise<void>((r) => {
          waiting = r;
        });
      }
    }
  }
}

// --- Singleton ---

let _provider: LLMProvider | null = null;

export function getLLMProvider(): LLMProvider {
  if (!_provider) _provider = new ClaudeCLIProvider();
  return _provider;
}

export function setLLMProvider(provider: LLMProvider): void {
  _provider = provider;
}
