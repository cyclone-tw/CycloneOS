// src/app/api/felo/chat/route.ts

import { NextRequest } from "next/server";
import { getApiKey, FELO_BASE_URL } from "@/lib/felo/client";
import { feloLiveDoc } from "@/lib/felo/livedoc";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IMAGES_DIR = join(process.cwd(), "public/uploads/felo/images");

export async function POST(req: NextRequest) {
  const { query, threadId, liveDocId, skillId } = await req.json();

  if (!query || typeof query !== "string") {
    return Response.json({ error: "query is required" }, { status: 400 });
  }

  let apiKey: string;
  try {
    apiKey = getApiKey();
  } catch {
    return Response.json({ error: "FELO_API_KEY not configured" }, { status: 500 });
  }

  // Resolve LiveDoc ID
  let resolvedLiveDocId = liveDocId;
  if (!resolvedLiveDocId) {
    try {
      const doc = await feloLiveDoc.getOrCreate();
      resolvedLiveDocId = doc.short_id;
    } catch (e) {
      return Response.json(
        { error: `LiveDoc error: ${e instanceof Error ? e.message : e}` },
        { status: 500 },
      );
    }
  }

  // Create or follow-up conversation
  const isFollowUp = !!threadId;
  const convUrl = isFollowUp
    ? `${FELO_BASE_URL}/v2/conversations/${threadId}/follow_up`
    : `${FELO_BASE_URL}/v2/conversations`;

  const convBody: Record<string, unknown> = { query };
  if (!isFollowUp) {
    convBody.live_doc_short_id = resolvedLiveDocId;
    if (skillId) convBody.skill_id = skillId;
  }

  try {
    const createRes = await fetch(convUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Accept-Language": "zh",
      },
      body: JSON.stringify(convBody),
    });

    if (!createRes.ok) {
      const errText = await createRes.text().catch(() => "Unknown");
      return Response.json(
        { error: `SuperAgent error: ${createRes.status} ${errText}` },
        { status: 502 },
      );
    }

    const convData = await createRes.json();
    const streamKey = convData.data?.stream_key;
    const resultThreadId = convData.data?.thread_short_id || threadId || "";
    const resultLiveDocId = convData.data?.live_doc_short_id || resolvedLiveDocId;

    if (!streamKey) {
      return Response.json({ error: "No stream_key" }, { status: 502 });
    }

    // Consume Felo SSE and re-emit to client
    const streamUrl = `${FELO_BASE_URL}/v2/conversations/stream/${streamKey}`;
    const streamRes = await fetch(streamUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!streamRes.ok || !streamRes.body) {
      return Response.json({ error: "SSE stream failed" }, { status: 502 });
    }

    const encoder = new TextEncoder();
    const feloReader = streamRes.body.getReader();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        const emit = (event: string, data: unknown) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        };

        emit("state", {
          threadId: resultThreadId,
          liveDocId: resultLiveDocId,
        });

        let buffer = "";

        try {
          while (true) {
            const { done, value } = await feloReader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6).trim();
                if (!data || data === "[DONE]") continue;

                try {
                  const parsed = JSON.parse(data);

                  if (parsed.content) {
                    emit("message", { content: parsed.content });
                  }

                  if (parsed.tool_name || parsed.toolName) {
                    const toolName = parsed.tool_name || parsed.toolName;

                    if (toolName === "generate_images") {
                      const urls = parsed.urls || (parsed.images || []).map(
                        (img: { url?: string }) => img.url,
                      ).filter(Boolean);

                      const localPaths: string[] = [];
                      await mkdir(IMAGES_DIR, { recursive: true });

                      for (const imgUrl of urls) {
                        try {
                          const imgRes = await fetch(imgUrl);
                          if (imgRes.ok) {
                            const imgBuf = Buffer.from(await imgRes.arrayBuffer());
                            const fname = `felo-img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.png`;
                            await writeFile(join(IMAGES_DIR, fname), imgBuf);
                            localPaths.push(`/uploads/felo/images/${fname}`);
                          }
                        } catch {
                          // Skip failed downloads
                        }
                      }

                      emit("tool-result", {
                        toolName,
                        title: parsed.title,
                        localPaths,
                      });
                    } else {
                      emit("tool-result", {
                        toolName,
                        title: parsed.title,
                        status: parsed.status,
                      });
                    }
                  }
                } catch {
                  if (data && !data.startsWith("{")) {
                    emit("message", { content: data });
                  }
                }
              }
            }
          }
        } catch (e) {
          emit("error", {
            message: e instanceof Error ? e.message : "Stream error",
          });
        }

        emit("done", {});
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
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Chat failed" },
      { status: 500 },
    );
  }
}
