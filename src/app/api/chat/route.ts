import { NextRequest } from "next/server";
import { spawnClaude } from "@/lib/claude-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { prompt, sessionId, permissionMode, model, provider } = body;

  if (!prompt || typeof prompt !== "string") {
    return new Response("Missing prompt", { status: 400 });
  }

  const proc = spawnClaude({ prompt, sessionId, permissionMode, model, provider });

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      let lastActivity = Date.now();

      const sendSSE = (type: string, content: string, extra?: Record<string, unknown>) => {
        if (closed) return;
        const data = JSON.stringify({ type, content, ...extra });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(timeoutCheck);
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      };

      proc.stdout?.on("data", (chunk: Buffer) => {
        lastActivity = Date.now();
        const text = chunk.toString();
        for (const line of text.split("\n")) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);

            const eventType = typeof event.type === "string" ? event.type : "";

            if (eventType === "thread.started" && typeof event.thread_id === "string") {
              sendSSE("session", "", { sessionId: event.thread_id });
            }

            for (const text of extractCodexText(event)) {
              sendSSE("text", text);
            }

            if (eventType === "error") {
              const message =
                typeof event.message === "string"
                  ? event.message
                  : typeof event.error === "string"
                    ? event.error
                    : null;
              if (message) sendSSE("error", message);
            }

            // Extract session ID from init event
            if (event.type === "system" && event.subtype === "init" && event.session_id) {
              sendSSE("session", "", { sessionId: event.session_id });
            }

            // Extract text content from assistant messages
            if (event.type === "assistant") {
              const content = event.message?.content;
              if (Array.isArray(content)) {
                for (const block of content) {
                  if (block.type === "text" && block.text) {
                    sendSSE("text", block.text);
                  }
                }
              }
            }

            // Handle content_block_delta for streaming text
            if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
              sendSSE("text", event.delta.text);
            }

          } catch {
            // Non-JSON line, skip
          }
        }
      });

      proc.stderr?.on("data", (chunk: Buffer) => {
        const text = chunk.toString().trim();
        if (text && !isIgnorableCliStderr(text)) sendSSE("error", text);
      });

      proc.on("close", (code) => {
        if (code !== 0) sendSSE("error", `Process exited with code ${code}`);
        cleanup();
      });

      proc.on("error", (err) => {
        sendSSE("error", `Failed to start agent CLI: ${err.message}`);
        cleanup();
      });

      // Timeout: 120 seconds with no output
      const timeoutCheck = setInterval(() => {
        if (Date.now() - lastActivity > 120_000) {
          sendSSE("error", "Response timeout (120s no output)");
          proc.kill();
          cleanup();
        }
      }, 10_000);
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
