// src/lib/felo/superagent.ts
//
// Blocking SuperAgent client: creates conversation, consumes full SSE stream,
// returns text + tool results. Used by generate-image route.
//
// Felo SSE format is double-encoded:
//   data:{"is_complete":false,"content":"{\"data\":{...},\"type\":\"...\"}","offset":N}

import { getApiKey, FELO_BASE_URL } from "./client";
import type {
  FeloSuperAgentOptions,
  FeloSuperAgentResult,
  FeloToolResult,
  FeloConversationResponse,
} from "./types";

export async function feloSuperAgent(
  opts: FeloSuperAgentOptions,
): Promise<FeloSuperAgentResult> {
  const { query, liveDocId, threadId, skillId, acceptLanguage = "zh" } = opts;
  const apiKey = getApiKey();

  const isFollowUp = !!threadId;
  const url = isFollowUp
    ? `${FELO_BASE_URL}/v2/conversations/${threadId}/follow_up`
    : `${FELO_BASE_URL}/v2/conversations`;

  const body: Record<string, unknown> = { query };
  if (!isFollowUp) {
    body.live_doc_short_id = liveDocId;
    if (skillId) body.skill_id = skillId;
  }

  const createRes = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Accept-Language": acceptLanguage,
    },
    body: JSON.stringify(body),
  });

  if (!createRes.ok) {
    const errText = await createRes.text().catch(() => "Unknown");
    throw new Error(`SuperAgent create failed ${createRes.status}: ${errText}`);
  }

  const convData = (await createRes.json()) as {
    data?: FeloConversationResponse;
  };
  const streamKey = convData.data?.stream_key;
  const resultThreadId = convData.data?.thread_short_id || threadId || "";
  const resultLiveDocId = convData.data?.live_doc_short_id || liveDocId;

  if (!streamKey) {
    throw new Error("No stream_key returned from SuperAgent");
  }

  const streamUrl = `${FELO_BASE_URL}/v2/conversations/stream/${streamKey}`;
  const streamRes = await fetch(streamUrl, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!streamRes.ok || !streamRes.body) {
    throw new Error(`SSE stream failed: ${streamRes.status}`);
  }

  let text = "";
  const toolResults: FeloToolResult[] = [];
  const reader = streamRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let lastOffset = -1;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

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

      // Skip duplicates
      if (typeof outer.offset === "number") {
        if (outer.offset <= lastOffset) continue;
        lastOffset = outer.offset;
      }

      // Error events (non-fatal in Felo)
      if (outer.message && !outer.content) continue;

      if (!outer.content) continue;

      // Double-encoded: outer.content is a JSON string
      let inner;
      try {
        inner = JSON.parse(outer.content);
      } catch {
        text += outer.content;
        continue;
      }

      const innerType = inner.type;
      const innerData = inner.data || {};

      switch (innerType) {
        case "answer":
        case "text": {
          if (innerData.text) text += innerData.text;
          else if (innerData.content) text += innerData.content;
          break;
        }

        case "tool_call":
        case "tool_result": {
          const toolName = innerData.tool_name || innerData.name || "";
          const toolResult: FeloToolResult = { toolName };

          if (innerData.title) toolResult.title = innerData.title;
          if (innerData.status) toolResult.status = innerData.status;

          // Extract image URLs from various formats
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
          if (urls.length > 0) toolResult.urls = urls;

          toolResults.push(toolResult);
          break;
        }

        default:
          if (innerData.text) text += innerData.text;
          break;
      }

      if (outer.is_complete) break;
    }
  }

  return {
    text,
    toolResults,
    threadId: resultThreadId,
    liveDocId: resultLiveDocId,
  };
}

export function extractImageUrls(result: FeloSuperAgentResult): string[] {
  return result.toolResults
    .filter((t) => t.toolName === "generate_images" && t.urls)
    .flatMap((t) => t.urls || []);
}
