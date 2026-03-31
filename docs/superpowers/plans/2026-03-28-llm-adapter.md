# LLM Adapter Abstraction Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development

**Goal:** Extract duplicated Claude CLI spawn logic into a provider-based LLM adapter, enabling future backend switching.

**Architecture:** Two layers — (1) unified streaming interface with async iterable events, (2) provider abstraction with ClaudeCLIProvider as default. All 3 direct-spawn routes (generate, refine, documents/process) and claude-bridge refactored to use the provider.

---

### Task 1: Create LLM Provider types and ClaudeCLIProvider

**Files:**
- Create: `dashboard/src/lib/llm-provider.ts`

- [ ] **Step 1: Create the provider file with types + implementation**

```typescript
// dashboard/src/lib/llm-provider.ts
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
  /** Disable MCP servers */
  noMcp?: boolean;
  /** Don't add vault directory */
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

    if (useStdin) {
      child.stdin!.write(options.prompt);
      child.stdin!.end();
    }

    yield* this.parseStream(child);
  }

  async healthCheck(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn("claude", ["--version"], { stdio: "pipe" });
      proc.on("close", (code) => resolve(code === 0));
      proc.on("error", () => resolve(false));
      setTimeout(() => { proc.kill(); resolve(false); }, 5000);
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

  private async *parseStream(child: ChildProcess): AsyncGenerator<LLMStreamEvent> {
    // Use a promise-based queue to convert event-driven streams to async iterable
    const queue: Array<LLMStreamEvent | null> = [];
    let resolve: (() => void) | null = null;
    let done = false;

    const push = (event: LLMStreamEvent | null) => {
      queue.push(event);
      if (resolve) { resolve(); resolve = null; }
    };

    let lineBuffer = "";

    const processLine = (line: string) => {
      if (!line.trim()) return;
      try {
        const parsed = JSON.parse(line);

        // Session ID
        if (parsed.type === "system") {
          const sid = parsed.session_id;
          if (sid) push({ type: "session", sessionId: sid });
        }

        // Streaming text delta
        if (parsed.type === "content_block_delta") {
          const text = parsed.content_block?.text ?? parsed.delta?.text;
          if (text) push({ type: "text", text });
        }

        // Full assistant message (used by some CLI versions)
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

        // Result event — may contain session_id
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
      push(null); // sentinel
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
        if (event === null) return; // stream ended
        yield event;
      } else if (done) {
        return;
      } else {
        await new Promise<void>((r) => { resolve = r; });
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
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/lib/llm-provider.ts
git commit -m "feat: add LLM provider abstraction with ClaudeCLIProvider"
```

---

### Task 2: Refactor presentations routes to use LLM provider

**Files:**
- Modify: `dashboard/src/app/api/presentations/generate/route.ts`
- Modify: `dashboard/src/app/api/presentations/refine/route.ts`

- [ ] **Step 1: Refactor generate/route.ts**

Remove: `import { spawn } from "child_process"` and all spawn/stream logic (~lines 136-270).
Add: `import { getLLMProvider } from "@/lib/llm-provider"`.

Replace the spawn + ReadableStream with:

```typescript
const provider = getLLMProvider();
const llmStream = provider.stream({
  prompt,
  model: "sonnet",
  stdinPrompt: true,
  noMcp: true,
  noVault: true,
});

const stream = new ReadableStream({
  async start(controller) {
    const encoder = new TextEncoder();
    const send = (event: string, data: unknown) => {
      controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
    };

    let accumulated = "";
    let sessionId = "";

    for await (const event of llmStream) {
      switch (event.type) {
        case "session":
          sessionId = event.sessionId ?? "";
          send("session", { sessionId });
          break;
        case "text":
          accumulated += event.text ?? "";
          send("text", { text: event.text });
          break;
        case "error":
          send("error", { message: event.error });
          break;
        case "done":
          // Parse accumulated text as outline JSON (keep existing parsing logic)
          // ... existing parse + validate logic stays the same ...
          break;
      }
    }

    // After stream ends, parse the accumulated JSON
    // (move the existing JSON parsing from child.on("close") here)
    try {
      const cleaned = cleanClaudeOutput(accumulated);
      // ... existing Strategy 1/2/3 parsing ...
      // ... existing validation ...
      if (outline) {
        send("outline", { outline, sessionId });
      } else {
        send("error", { message: `Claude did not return valid outline JSON. Response: ${cleaned.substring(0, 200)}...` });
      }
    } catch (e) {
      send("error", { message: `Failed to parse outline JSON: ${e}` });
    }

    send("done", {});
    controller.close();
  },
});
```

Keep: `readSourceContents()`, `SLIDE_OUTLINE_PROMPT()`, all JSON parsing strategies, all validation logic.

- [ ] **Step 2: Refactor refine/route.ts**

Same pattern. Remove spawn, use `getLLMProvider().stream()`.

Key difference: `sessionId` may be provided for resume:
```typescript
const llmStream = provider.stream({
  prompt,
  model: "sonnet",
  stdinPrompt: true,
  noMcp: true,
  noVault: true,
  sessionId: claudeSessionId || undefined,
});
```

Keep: `buildRefinePrompt()`, all JSON parsing, all validation.

- [ ] **Step 3: Verify both routes build**

```bash
cd dashboard && npx next build 2>&1 | grep -E "error|Error|✓"
```

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(presentations): use LLM provider instead of direct Claude CLI spawn"
```

---

### Task 3: Refactor documents/process route to use LLM provider

**Files:**
- Modify: `dashboard/src/app/api/documents/process/route.ts`

- [ ] **Step 1: Refactor to use provider**

Remove: `import { spawn } from "child_process"` and direct spawn logic.
Add: `import { getLLMProvider } from "@/lib/llm-provider"`.

```typescript
const provider = getLLMProvider();
const llmStream = provider.stream({
  prompt,
  model: "sonnet",
  stdinPrompt: true,
  noMcp: true,
  noVault: true,
  sessionId: claudeSessionId || undefined,
  permissionMode: "bypassPermissions",
  disallowedTools: ["Write", "Edit", "Bash", "NotebookEdit"],
});
```

The documents route has a different SSE format (`data: {type, content}\n\n`) and additional logic for saving files. Keep: `markdownToRevealHtml()`, file saving logic, `expandHome()`.

Note: documents route uses cumulative text tracking (`lastTextLength`). With the provider stream, each `text` event is a delta (not cumulative), so this should simplify to just `fullContent += event.text`.

- [ ] **Step 2: Verify build**
- [ ] **Step 3: Commit**

```bash
git commit -m "refactor(documents): use LLM provider instead of direct Claude CLI spawn"
```

---

### Task 4: Refactor claude-bridge to use ClaudeCLIProvider

**Files:**
- Modify: `dashboard/src/lib/claude-bridge.ts`

- [ ] **Step 1: Simplify claude-bridge**

Keep `spawnClaude()` as a backwards-compatible wrapper that delegates to `ClaudeCLIProvider` internally. The function still returns `ChildProcess` for `local-executor.ts` which needs the raw process.

Actually, `local-executor.ts` needs the ChildProcess for its own stream parsing + event bus integration. The LLM provider's async iterable doesn't fit the local-executor's event-driven pattern well. So:

- Keep `spawnClaude()` as-is for now (local-executor depends on it)
- But extract the args-building logic to share with `ClaudeCLIProvider`
- Remove `checkClaudeHealth()` from claude-bridge (moved to provider)

```typescript
import { ClaudeCLIProvider } from "./llm-provider";

// Legacy wrapper for local-executor compatibility
export function spawnClaude(options: ClaudeBridgeOptions): ChildProcess {
  // ... keep existing implementation ...
}

export async function checkClaudeHealth(): Promise<boolean> {
  const provider = new ClaudeCLIProvider();
  return provider.healthCheck();
}
```

- [ ] **Step 2: Commit**

```bash
git commit -m "refactor: delegate health check to LLM provider, keep spawnClaude for executor compat"
```
