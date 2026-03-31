// src/app/api/felo/chat/route.ts
//
// Felo SuperAgent SSE proxy with reconnection support.
// Felo SSE is double-encoded and uses types like:
//   start, message, processing, answer, tools, tools_result_stream, done

import { NextRequest } from "next/server";
import { getApiKey, FELO_BASE_URL } from "@/lib/felo/client";
import { feloLiveDoc } from "@/lib/felo/livedoc";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IMAGES_DIR = join(process.cwd(), "public/uploads/felo/images");
const MAX_RECONNECTS = 5;
const RECONNECT_DELAY = 2000;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

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
        "Accept-Language": "zh-TW",
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

    const encoder = new TextEncoder();

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

        let lastOffset = -1;
        let reconnects = 0;
        let streamDone = false;

        while (!streamDone && reconnects <= MAX_RECONNECTS) {
          try {
            const streamUrl = lastOffset > -1
              ? `${FELO_BASE_URL}/v2/conversations/stream/${streamKey}?offset=${lastOffset}`
              : `${FELO_BASE_URL}/v2/conversations/stream/${streamKey}`;

            console.log(`[felo-chat] connecting stream (reconnect=${reconnects}, offset=${lastOffset})`);

            const streamRes = await fetch(streamUrl, {
              headers: { Authorization: `Bearer ${apiKey}` },
            });

            if (!streamRes.ok || !streamRes.body) {
              console.log(`[felo-chat] stream HTTP ${streamRes.status}`);
              break;
            }

            const feloReader = streamRes.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
              const { done, value } = await feloReader.read();
              if (done) {
                console.log("[felo-chat] stream reader done");
                break;
              }

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";

              for (const line of lines) {
                const dataPrefix = line.startsWith("data:") ? "data:" : line.startsWith("data: ") ? "data: " : null;
                if (!dataPrefix) continue;

                const raw = line.slice(dataPrefix.length).trim();
                if (!raw || raw === "[DONE]") continue;

                let outer;
                try {
                  outer = JSON.parse(raw);
                } catch {
                  continue;
                }

                if (typeof outer.offset === "number") {
                  if (outer.offset <= lastOffset) continue;
                  lastOffset = outer.offset;
                }

                // Non-fatal error from Felo — trigger reconnect
                if (outer.message && !outer.content) {
                  console.log("[felo-chat] error event, will reconnect:", outer.message);
                  continue;
                }

                if (!outer.content) continue;

                let inner;
                try {
                  inner = JSON.parse(outer.content);
                } catch {
                  emit("message", { content: outer.content });
                  continue;
                }

                const innerType = inner.type;
                const innerData = inner.data || {};

                switch (innerType) {
                  case "answer":
                  case "text": {
                    const txt = innerData.text || innerData.content || "";
                    if (txt) emit("message", { content: txt });
                    break;
                  }

                  case "processing": {
                    // Felo system message (always simplified Chinese) — show localized
                    emit("message", { content: "_處理中..._\n" });
                    break;
                  }

                  case "tools": {
                    // Tool call params — show what's being generated
                    const tools = innerData.tools || [];
                    for (const tool of tools) {
                      if (tool.name === "generate_images" && tool.params?.images) {
                        for (const img of tool.params.images) {
                          emit("message", { content: `_🎨 生成圖片中：${img.title || ""}..._\n` });
                        }
                      }
                    }
                    break;
                  }

                  case "tools_result_stream": {
                    const tools = innerData.tools || [];
                    for (const tool of tools) {
                      const toolName = tool.tool_name || "";

                      if (toolName === "generate_images") {
                        // Check each image result
                        const results = tool.call_result || tool.images || [];
                        for (const img of results) {
                          if (img.status === "completed" && img.url) {
                            // Image ready — download it
                            try {
                              await mkdir(IMAGES_DIR, { recursive: true });
                              const imgRes = await fetch(img.url);
                              if (imgRes.ok) {
                                const imgBuf = Buffer.from(await imgRes.arrayBuffer());
                                const fname = `felo-img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.png`;
                                await writeFile(join(IMAGES_DIR, fname), imgBuf);
                                const localPath = `/uploads/felo/images/${fname}`;
                                emit("tool-result", {
                                  toolName: "generate_images",
                                  title: img.title,
                                  localPaths: [localPath],
                                });
                                console.log("[felo-chat] image downloaded:", localPath);
                              }
                            } catch (dlErr) {
                              console.log("[felo-chat] image download failed:", dlErr);
                            }
                          } else if (img.status === "generating") {
                            emit("message", { content: `_🎨 圖片生成中..._\n` });
                          }
                        }
                      }
                    }
                    break;
                  }

                  case "start":
                  case "message":
                  case "connected":
                  case "heartbeat":
                    break;

                  case "done":
                  case "completed":
                  case "complete":
                    streamDone = true;
                    break;

                  default: {
                    const txt = innerData.text || innerData.content || "";
                    if (txt) emit("message", { content: txt });
                    console.log("[felo-chat] unhandled type:", innerType);
                    break;
                  }
                }

                if (outer.is_complete) {
                  streamDone = true;
                  break;
                }
              }

              if (streamDone) break;
            }
          } catch (e) {
            console.log("[felo-chat] stream error, reconnecting:", e);
          }

          if (!streamDone) {
            reconnects++;
            if (reconnects <= MAX_RECONNECTS) {
              console.log(`[felo-chat] reconnecting in ${RECONNECT_DELAY}ms (attempt ${reconnects})`);
              await sleep(RECONNECT_DELAY);
            }
          }
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
