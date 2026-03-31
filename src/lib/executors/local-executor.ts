import type { Executor, ExecutorProcess } from "./executor";
import type { SpawnOptions } from "../agents/types";
import { spawnClaude } from "../claude-bridge";
import { eventBus } from "../event-bus";

export class LocalExecutor implements Executor {
  private processes = new Map<string, ExecutorProcess>();

  spawn(processId: string, options: SpawnOptions): ExecutorProcess {
    const proc = spawnClaude({
      prompt: options.prompt,
      sessionId: options.sessionId,
      permissionMode: options.permissionMode,
      model: options.model,
      appendSystemPrompt: options.systemPrompt,
      extraContextDirs: options.contextDirs,
    });

    const execProc: ExecutorProcess = {
      id: processId,
      childProcess: proc,
      agentType: options.agentType,
    };
    this.processes.set(processId, execProc);

    this.attachStreamParser(processId, proc);

    proc.on("close", () => {
      this.processes.delete(processId);
    });

    proc.on("error", (err) => {
      eventBus.emitAgentEvent({
        type: "error",
        processId,
        content: `Failed to start claude: ${err.message}`,
        timestamp: Date.now(),
      });
      this.processes.delete(processId);
    });

    return execProc;
  }

  kill(processId: string): void {
    const proc = this.processes.get(processId);
    if (proc) {
      proc.childProcess.kill();
      this.processes.delete(processId);
    }
  }

  private attachStreamParser(
    processId: string,
    proc: import("child_process").ChildProcess
  ): void {
    let buffer = "";
    let lastActivity = Date.now();

    proc.stdout?.on("data", (chunk: Buffer) => {
      lastActivity = Date.now();
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          this.parseStreamEvent(processId, event);
        } catch {
          // Non-JSON line, skip
        }
      }
    });

    proc.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (text) {
        eventBus.emitAgentEvent({
          type: "error",
          processId,
          content: text,
          timestamp: Date.now(),
        });
      }
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        eventBus.emitAgentEvent({
          type: "error",
          processId,
          content: `Process exited with code ${code}`,
          timestamp: Date.now(),
        });
      }
      eventBus.emitAgentEvent({
        type: "done",
        processId,
        timestamp: Date.now(),
      });
    });

    // Inactivity timeout: 120s
    const timeoutCheck = setInterval(() => {
      if (!this.processes.has(processId)) {
        clearInterval(timeoutCheck);
        return;
      }
      if (Date.now() - lastActivity > 120_000) {
        eventBus.emitAgentEvent({
          type: "error",
          processId,
          content: "Response timeout (120s no output)",
          timestamp: Date.now(),
        });
        this.kill(processId);
        clearInterval(timeoutCheck);
      }
    }, 10_000);

    proc.on("close", () => clearInterval(timeoutCheck));
  }

  private parseStreamEvent(
    processId: string,
    event: Record<string, unknown>
  ): void {
    const now = Date.now();

    // Session ID from init
    if (event.type === "system" && event.subtype === "init" && event.session_id) {
      eventBus.emitAgentEvent({
        type: "session",
        processId,
        sessionId: event.session_id as string,
        timestamp: now,
      });
    }

    // Text content from assistant message
    if (event.type === "assistant" && event.message) {
      const msg = event.message as { content?: Array<{ type: string; text?: string; name?: string; input?: unknown }> };
      if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === "text" && block.text) {
            eventBus.emitAgentEvent({
              type: "text",
              processId,
              content: block.text,
              timestamp: now,
            });
          }
          if (block.type === "tool_use" && block.name) {
            eventBus.emitAgentEvent({
              type: "tool_use",
              processId,
              toolName: block.name,
              toolInput: JSON.stringify(block.input).slice(0, 500),
              timestamp: now,
            });
          }
        }
      }
    }

    // Streaming text delta
    if (event.type === "content_block_delta") {
      const delta = event.delta as { type?: string; text?: string } | undefined;
      if (delta?.type === "text_delta" && delta.text) {
        eventBus.emitAgentEvent({
          type: "text",
          processId,
          content: delta.text,
          timestamp: now,
        });
      }
    }

    // Result event (final) — capture session ID
    if (event.type === "result") {
      const sessionId = event.session_id as string | undefined;
      if (sessionId) {
        eventBus.emitAgentEvent({
          type: "session",
          processId,
          sessionId,
          timestamp: now,
        });
      }
    }
  }
}
