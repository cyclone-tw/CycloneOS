// dashboard/src/lib/llm-provider.ts
//
// LLM Provider abstraction layer.
// Default: ClaudeCLIProvider (spawns Claude CLI).
// Future: AnthropicSDKProvider, OpenAIProvider, etc.

import { spawn, type ChildProcess } from "child_process";
import { PATHS } from "@/config/paths-config";
import type { AgentCliProvider } from "@/types/chat";

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
  provider?: AgentCliProvider;
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

const CWD = process.cwd();
const VAULT = PATHS.obsidianVault;

function isIgnorableCliStderr(text: string): boolean {
  return (
    text === "Reading additional input from stdin..." ||
    text.startsWith("WARNING: proceeding, even though we could not update PATH:")
  );
}

function extractCodexText(event: Record<string, unknown>): string[] {
  const results: string[] = [];
  const seen = new Set<string>();

  const push = (value: unknown) => {
    if (typeof value !== "string") return;
    const text = value.trim();
    if (!text || seen.has(text)) return;
    seen.add(text);
    results.push(value);
  };

  const visit = (value: unknown): void => {
    if (!value) return;

    if (typeof value === "string") {
      push(value);
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }

    if (typeof value !== "object") return;

    const record = value as Record<string, unknown>;
    if (record.type === "reasoning") return;

    if (typeof record.delta === "string") push(record.delta);
    if (typeof record.text === "string") push(record.text);

    const textValue = record.text;
    if (
      textValue &&
      typeof textValue === "object" &&
      "value" in (textValue as Record<string, unknown>)
    ) {
      push((textValue as Record<string, unknown>).value);
    }

    visit(record.delta);
    visit(record.message);
    visit(record.content);
    visit(record.item);
    visit(record.output);
  };

  visit(event);
  return results;
}

function mapCodexModel(model?: string): string | undefined {
  if (!model) return process.env.CODEX_MODEL ?? "gpt-5";
  if (model === "opus") return process.env.CODEX_MODEL_OPUS ?? process.env.CODEX_MODEL ?? "gpt-5";
  if (model === "sonnet") return process.env.CODEX_MODEL_SONNET ?? process.env.CODEX_MODEL ?? "gpt-5";
  if (model === "haiku") return process.env.CODEX_MODEL_HAIKU ?? process.env.CODEX_MODEL ?? "gpt-5-mini";
  return model;
}

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
      if (msg && !isIgnorableCliStderr(msg)) push({ type: "error", error: msg });
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

export class CodexCLIProvider implements LLMProvider {
  async *stream(options: LLMRequestOptions): AsyncGenerator<LLMStreamEvent> {
    const args = this.buildArgs(options);
    const useStdin = options.stdinPrompt ?? false;
    const child = spawn("codex", args, {
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
      const proc = spawn("codex", ["--version"], { stdio: "pipe" });
      proc.on("close", (code) => resolve(code === 0));
      proc.on("error", () => resolve(false));
      setTimeout(() => {
        proc.kill();
        resolve(false);
      }, 5000);
    });
  }

  private buildArgs(options: LLMRequestOptions): string[] {
    const args = ["exec", "--skip-git-repo-check", "--json", "-C", CWD, "--sandbox", "workspace-write"];
    const model = mapCodexModel(options.model);
    const prompt = options.appendSystemPrompt
      ? `${options.appendSystemPrompt}\n\nUser request:\n${options.prompt}`
      : options.prompt;

    if (model) args.push("--model", model);
    if (options.permissionMode === "bypassPermissions") {
      args.push("--dangerously-bypass-approvals-and-sandbox");
    }
    if (!options.noVault) {
      args.push("--add-dir", VAULT);
    }
    if (options.extraContextDirs) {
      for (const dir of options.extraContextDirs) {
        if (dir !== VAULT) args.push("--add-dir", dir);
      }
    }

    if (options.sessionId) {
      args.push("resume", options.sessionId);
      if (options.stdinPrompt) {
        args.push("-");
      } else {
        args.push(prompt);
      }
    } else if (options.stdinPrompt) {
      args.push("-");
    } else {
      args.push(prompt);
    }

    return args;
  }

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
        const parsed = JSON.parse(line) as Record<string, unknown>;
        if (parsed.type === "thread.started" && typeof parsed.thread_id === "string") {
          push({ type: "session", sessionId: parsed.thread_id });
        }
        if (parsed.type === "error") {
          const message =
            typeof parsed.message === "string"
              ? parsed.message
              : typeof parsed.error === "string"
                ? parsed.error
                : null;
          if (message) push({ type: "error", error: message });
        }
        for (const text of extractCodexText(parsed)) {
          push({ type: "text", text });
        }
      } catch {
        // skip
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
      if (msg && !isIgnorableCliStderr(msg)) push({ type: "error", error: msg });
    });

    child.on("close", (code) => {
      if (lineBuffer.trim()) processLine(lineBuffer);
      if (code !== 0) {
        push({ type: "error", error: `Codex exited with code ${code}` });
      }
      push({ type: "done" });
      push(null);
      done = true;
    });

    child.on("error", (err) => {
      push({ type: "error", error: `Failed to start codex: ${err.message}` });
      push(null);
      done = true;
    });

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

// --- OpenAI Provider ---

export class OpenAIProvider implements LLMProvider {
  private model: string;

  constructor(model = "gpt-4o") {
    this.model = model;
  }

  async *stream(options: LLMRequestOptions): AsyncGenerator<LLMStreamEvent> {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI(); // uses OPENAI_API_KEY env var

    const messages: Array<{ role: "system" | "user"; content: string }> = [];
    if (options.appendSystemPrompt) {
      messages.push({ role: "system", content: options.appendSystemPrompt });
    }
    messages.push({ role: "user", content: options.prompt });

    const model = options.model || this.model;
    const sessionId = `openai-${Date.now()}`;

    yield { type: "session", sessionId };

    try {
      const response = await client.chat.completions.create({
        model,
        messages,
        stream: true,
      });

      for await (const chunk of response) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          yield { type: "text", text: delta };
        }
      }

      yield { type: "done" };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      yield { type: "error", error: message };
      yield { type: "done" };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const { default: OpenAI } = await import("openai");
      const client = new OpenAI();
      await client.models.list();
      return true;
    } catch {
      return false;
    }
  }
}

// --- Singleton ---

export function getLLMProvider(provider?: AgentCliProvider | "openai"): LLMProvider {
  const providerType = provider ?? ((process.env.LLM_PROVIDER ?? "claude") as AgentCliProvider | "openai");
  switch (providerType) {
    case "openai":
      return new OpenAIProvider(process.env.OPENAI_MODEL);
    case "codex":
      return new CodexCLIProvider();
    default:
      return new ClaudeCLIProvider();
  }
}

export function setLLMProvider(provider: LLMProvider): void {
  void provider;
}
