import { EventEmitter } from "events";
import type { AgentEvent } from "./agents/types";

/**
 * Central event bus for all agent stream events.
 * Server-side singleton — each agent process emits events here,
 * and SSE routes subscribe to forward events to clients.
 */
class AgentEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }

  /** Emit an event for a specific agent process */
  emitAgentEvent(event: AgentEvent): void {
    this.emit(`agent:${event.processId}`, event);
    this.emit("agent:*", event);
  }

  /** Subscribe to events for a specific process */
  onProcessEvent(processId: string, handler: (event: AgentEvent) => void): void {
    this.on(`agent:${processId}`, handler);
  }

  /** Unsubscribe from process events */
  offProcessEvent(processId: string, handler: (event: AgentEvent) => void): void {
    this.off(`agent:${processId}`, handler);
  }

  /** Subscribe to all agent events (for activity feed) */
  onAllEvents(handler: (event: AgentEvent) => void): void {
    this.on("agent:*", handler);
  }

  offAllEvents(handler: (event: AgentEvent) => void): void {
    this.off("agent:*", handler);
  }
}

// Survive Next.js HMR by persisting on globalThis
const g = globalThis as unknown as { __agentEventBus?: AgentEventBus };
export const eventBus: AgentEventBus = g.__agentEventBus ??= new AgentEventBus();
