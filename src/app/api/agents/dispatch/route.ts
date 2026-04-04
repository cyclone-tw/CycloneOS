import { NextRequest } from "next/server";
import { agentManager } from "@/lib/agent-manager";
import { eventBus } from "@/lib/event-bus";
import type { AgentEvent } from "@/lib/agents/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { agentType, prompt, sessionId, model, permissionMode, provider } = body;

  if (!agentType || !prompt) {
    return Response.json({ error: "Missing agentType or prompt" }, { status: 400 });
  }

  let processId: string;
  try {
    processId = agentManager.dispatch(agentType, prompt, sessionId, {
      model,
      permissionMode,
      provider,
    });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }

  // Return SSE stream (combined dispatch + stream, no race condition)
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let closed = false;

      const send = (data: Record<string, unknown>) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // Send processId as first event so frontend can use it for stop
      send({ type: "process", processId });

      // If process was queued (pool full), notify frontend
      if (!agentManager.getProcess(processId)) {
        send({ type: "queued", processId });
      }

      const handler = (event: AgentEvent) => {
        send({
          type: event.type,
          processId: event.processId,
          content: event.content,
          toolName: event.toolName,
          toolInput: event.toolInput,
          toolOutput: event.toolOutput,
          sessionId: event.sessionId,
          timestamp: event.timestamp,
        });

        if (event.type === "done") {
          if (!closed) {
            closed = true;
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          }
          eventBus.offProcessEvent(processId, handler);
        }
      };

      eventBus.onProcessEvent(processId, handler);

      // Cleanup if client disconnects — kill orphaned process
      req.signal.addEventListener("abort", () => {
        closed = true;
        eventBus.offProcessEvent(processId, handler);
        agentManager.stop(processId);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
