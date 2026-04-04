import { LocalExecutor } from "./executors/local-executor";
import type { ExecutorProcess } from "./executors/executor";
import { getAgentDefinition } from "./agents/definitions";
import type { AgentProcess, AgentEvent } from "./agents/types";
import type { AgentCliProvider, AgentModel, PermissionMode } from "@/types/chat";
import { eventBus } from "./event-bus";
import { sessionStore } from "./session-store";

const MAX_CONCURRENT = 4;

interface QueueItem {
  processId: string;
  agentType: string;
  prompt: string;
  sessionId?: string | null;
  model?: AgentModel;
  permissionMode?: PermissionMode;
  provider?: AgentCliProvider;
}

class AgentManager {
  private executor = new LocalExecutor();
  private active = new Map<string, { exec: ExecutorProcess; agent: AgentProcess }>();
  private queue: QueueItem[] = [];
  private draining = false;

  dispatch(
    agentType: string,
    prompt: string,
    sessionId?: string | null,
    overrides?: Pick<QueueItem, "model" | "permissionMode" | "provider">
  ): string {
    const def = getAgentDefinition(agentType);
    if (!def) throw new Error(`Unknown agent type: ${agentType}`);

    const processId = crypto.randomUUID().slice(0, 12);

    if (this.active.size >= MAX_CONCURRENT) {
      // Queue — return processId immediately. SSE subscriber will wait for events
      // once the queue drains and the process actually starts.
      this.queue.push({ processId, agentType, prompt, sessionId, ...overrides });
      return processId;
    }

    this.startProcess(processId, agentType, prompt, sessionId ?? null, def.systemPrompt, overrides);
    return processId;
  }

  private startProcess(
    processId: string,
    agentType: string,
    prompt: string,
    sessionId: string | null,
    systemPrompt: string,
    overrides?: Pick<QueueItem, "model" | "permissionMode" | "provider">
  ): void {
    const def = getAgentDefinition(agentType)!;

    const exec = this.executor.spawn(processId, {
      agentType,
      prompt,
      sessionId,
      model: overrides?.model ?? def.model,
      permissionMode: overrides?.permissionMode ?? def.permissionMode,
      provider: overrides?.provider,
      systemPrompt,
      contextDirs: def.contextDirs,
    });

    const agent: AgentProcess = {
      id: processId,
      agentType,
      sessionId,
      status: "streaming",
      pid: exec.childProcess.pid ?? null,
      startedAt: Date.now(),
    };

    this.active.set(processId, { exec, agent });

    // Named handler for proper cleanup (avoids listener leak)
    const handler = (event: AgentEvent) => {
      if (event.type === "session" && event.sessionId) {
        agent.sessionId = event.sessionId;
        sessionStore.upsertSession(event.sessionId, agentType);
      }
      if (event.type === "tool_use" && agent.sessionId) {
        sessionStore.addActivity(
          agent.sessionId,
          event.toolName ?? "unknown",
          event.toolInput
        );
      }
      if (event.type === "error") {
        agent.status = "error";
      }
      if (event.type === "done") {
        // Guard: stop() may have already removed this entry
        if (!this.active.has(processId)) {
          eventBus.offProcessEvent(processId, handler);
          return;
        }
        // Preserve error status if process errored before done
        if (agent.status !== "error") {
          agent.status = "idle";
        }
        this.active.delete(processId);
        eventBus.offProcessEvent(processId, handler);
        this.drainQueue();
      }
    };

    eventBus.onProcessEvent(processId, handler);
  }

  stop(processId: string): boolean {
    const entry = this.active.get(processId);
    if (!entry) return false;
    this.executor.kill(processId);
    entry.agent.status = "idle";
    this.active.delete(processId);

    // Emit done event so SSE subscribers receive a clean close signal.
    // The handler registered in startProcess() will self-cleanup when it
    // sees the entry was already removed from this.active.
    eventBus.emitAgentEvent({
      type: "done",
      processId,
      timestamp: Date.now(),
    });

    this.drainQueue();
    return true;
  }

  getProcess(processId: string): AgentProcess | undefined {
    return this.active.get(processId)?.agent;
  }

  listActive(): AgentProcess[] {
    return Array.from(this.active.values()).map((v) => v.agent);
  }

  getPoolStatus(): { active: number; queued: number; maxConcurrent: number } {
    return {
      active: this.active.size,
      queued: this.queue.length,
      maxConcurrent: MAX_CONCURRENT,
    };
  }

  private drainQueue(): void {
    if (this.draining) return; // prevent re-entrant calls
    this.draining = true;
    while (this.queue.length > 0 && this.active.size < MAX_CONCURRENT) {
      const next = this.queue.shift()!;
      const def = getAgentDefinition(next.agentType);
      if (def) {
        this.startProcess(
          next.processId,
          next.agentType,
          next.prompt,
          next.sessionId ?? null,
          def.systemPrompt,
          {
            model: next.model,
            permissionMode: next.permissionMode,
            provider: next.provider,
          }
        );
      } else {
        // Unknown agent type in queue — emit error and skip
        eventBus.emitAgentEvent({
          type: "error",
          processId: next.processId,
          content: `Unknown agent type: ${next.agentType}`,
          timestamp: Date.now(),
        });
        eventBus.emitAgentEvent({
          type: "done",
          processId: next.processId,
          timestamp: Date.now(),
        });
      }
    }
    this.draining = false;
  }
}

// Survive Next.js HMR
const g = globalThis as unknown as { __agentManager?: AgentManager };
export const agentManager: AgentManager = g.__agentManager ??= new AgentManager();
