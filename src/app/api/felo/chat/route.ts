// src/app/api/felo/chat/route.ts
//
// Felo SuperAgent SSE proxy: creates/resumes conversations,
// consumes Felo's double-encoded SSE stream, downloads generated images,
// and re-emits clean SSE events to the frontend.

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
        let lastOffset = -1;

        try {
          while (true) {
            const { done, value } = await feloReader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              // Felo SSE format: data:{"is_complete":...,"content":"<inner-json-string>","offset":N}
              // Also: data: {"message":"stream error"} for errors
              const dataPrefix = line.startsWith("data:") ? "data:" : line.startsWith("data: ") ? "data: " : null;
              if (!dataPrefix) continue;

              const raw = line.slice(dataPrefix.length).trim();
              if (!raw || raw === "[DONE]") continue;

              let outer;
              try {
                outer = JSON.parse(raw);
              } catch {
                console.log("[felo-chat] non-JSON data:", raw.slice(0, 200));
                continue;
              }

              // Skip duplicate offsets
              if (typeof outer.offset === "number") {
                if (outer.offset <= lastOffset) continue;
                lastOffset = outer.offset;
              }

              // Error events
              if (outer.message && !outer.content) {
                console.log("[felo-chat] error event:", outer.message);
                // Don't emit as fatal error — Felo sometimes sends non-fatal error events
                continue;
              }

              // The real content is double-encoded: outer.content is a JSON string
              if (!outer.content) continue;

              let inner;
              try {
                inner = JSON.parse(outer.content);
              } catch {
                // Content is plain text, not JSON
                emit("message", { content: outer.content });
                continue;
              }

              const innerType = inner.type;
              const innerData = inner.data || {};

              console.log("[felo-chat] inner type:", innerType, "keys:", Object.keys(innerData).join(","));

              switch (innerType) {
                case "answer":
                case "text": {
                  // Streaming text content
                  if (innerData.text) {
                    emit("message", { content: innerData.text });
                  } else if (innerData.content) {
                    emit("message", { content: innerData.content });
                  }
                  break;
                }

                case "processing": {
                  // Status update — show to user
                  if (innerData.message) {
                    emit("message", { content: `_${innerData.message}_\n` });
                  }
                  break;
                }

                case "tool_call":
                case "tool_result": {
                  const toolName = innerData.tool_name || innerData.name || "";
                  console.log("[felo-chat] tool:", toolName, JSON.stringify(innerData).slice(0, 500));

                  if (toolName === "generate_images") {
                    // Extract image URLs from various possible formats
                    const urls: string[] = [];
                    if (innerData.urls) urls.push(...innerData.urls);
                    if (innerData.images) {
                      for (const img of innerData.images) {
                        if (typeof img === "string") urls.push(img);
                        else if (img?.url) urls.push(img.url);
                      }
                    }
                    if (innerData.result?.urls) urls.push(...innerData.result.urls);
                    if (innerData.result?.images) {
                      for (const img of innerData.result.images) {
                        if (typeof img === "string") urls.push(img);
                        else if (img?.url) urls.push(img.url);
                      }
                    }

                    if (urls.length > 0) {
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
                        } catch (dlErr) {
                          console.log("[felo-chat] image download failed:", imgUrl, dlErr);
                        }
                      }

                      emit("tool-result", { toolName, title: innerData.title, localPaths });
                    } else {
                      emit("tool-result", { toolName, title: innerData.title, status: "processing" });
                    }
                  } else {
                    emit("tool-result", {
                      toolName,
                      title: innerData.title,
                      status: innerData.status || "done",
                    });
                  }
                  break;
                }

                case "message": {
                  // Echo of user message — skip
                  break;
                }

                case "start":
                case "connected":
                case "heartbeat": {
                  // Control events — skip
                  break;
                }

                case "done":
                case "completed":
                case "complete": {
                  // Stream finished
                  break;
                }

                default: {
                  // Unknown type — log and try to extract text
                  console.log("[felo-chat] unknown type:", innerType, JSON.stringify(inner).slice(0, 300));
                  if (innerData.text) {
                    emit("message", { content: innerData.text });
                  } else if (innerData.content) {
                    emit("message", { content: innerData.content });
                  }
                  break;
                }
              }

              // Check if stream is complete
              if (outer.is_complete) {
                break;
              }
            }
          }
        } catch (e) {
          console.error("[felo-chat] stream error:", e);
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
