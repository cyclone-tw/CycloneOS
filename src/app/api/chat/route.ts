import { NextRequest } from "next/server";
import { spawnClaude } from "@/lib/claude-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { prompt, sessionId, permissionMode, model } = body;

  if (!prompt || typeof prompt !== "string") {
    return new Response("Missing prompt", { status: 400 });
  }

  const proc = spawnClaude({ prompt, sessionId, permissionMode, model });

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
        if (text) sendSSE("error", text);
      });

      proc.on("close", (code) => {
        if (code !== 0) sendSSE("error", `Process exited with code ${code}`);
        cleanup();
      });

      proc.on("error", (err) => {
        sendSSE("error", `Failed to start claude: ${err.message}`);
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
