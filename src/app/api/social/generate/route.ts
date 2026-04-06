// src/app/api/social/generate/route.ts
// Streaming SSE route — generates social posts via LLM.

import { getLLMProvider } from "@/lib/llm-provider";
import { buildSocialPrompt, type Platform, type Tone } from "@/lib/social/prompts";
import { cleanClaudeOutput, fixJsonControlChars } from "@/lib/documents-utils";
import type { AgentCliProvider } from "@/types/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface GenerateRequestBody {
  text: string;
  platforms: Platform[];
  tone: Tone;
  provider?: AgentCliProvider;
  model?: string;
}

export async function POST(request: Request) {
  const body = (await request.json()) as GenerateRequestBody;
  const { text, platforms, tone, provider: reqProvider, model } = body;

  // Validate inputs
  if (!text || !text.trim()) {
    return Response.json({ error: "text must be non-empty" }, { status: 400 });
  }
  if (!platforms || platforms.length === 0) {
    return Response.json({ error: "platforms must have at least 1 item" }, { status: 400 });
  }

  const prompt = buildSocialPrompt(text, platforms, tone);
  const llm = getLLMProvider(reqProvider);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      let accumulated = "";

      try {
        for await (const event of llm.stream({
          prompt,
          model,
          stdinPrompt: true,
          noMcp: true,
          noVault: true,
        })) {
          switch (event.type) {
            case "session":
              send("session", { sessionId: event.sessionId });
              break;
            case "text":
              accumulated += event.text!;
              send("text", { text: event.text });
              break;
            case "error":
              send("error", { message: event.error });
              break;
          }
        }
      } catch (e) {
        send("error", { message: `Stream error: ${e}` });
      }

      // Parse accumulated text as JSON
      if (accumulated) {
        try {
          const cleaned = fixJsonControlChars(cleanClaudeOutput(accumulated));

          const tryParse = (t: string) => {
            try { return JSON.parse(t); } catch { return null; }
          };

          // Strategy 1: Direct parse
          let result = tryParse(cleaned.trim());

          // Strategy 2: Strip markdown fences
          if (!result) {
            const fenceStripped = cleaned
              .replace(/^```(?:json)?\s*\n?/m, "")
              .replace(/\n?```\s*$/m, "")
              .trim();
            result = tryParse(fenceStripped);
          }

          if (result) {
            send("result", result);
          } else {
            send("error", { message: `Failed to parse JSON. Response: ${cleaned.substring(0, 200)}...` });
          }
        } catch (e) {
          send("error", { message: `Failed to parse response JSON: ${e}` });
        }
      }

      send("done", {});
      controller.close();
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
