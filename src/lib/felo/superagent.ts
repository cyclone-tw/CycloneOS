// src/lib/felo/superagent.ts

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

  while (true) {
    const { done, value } = await reader.read();
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
            text += parsed.content;
          }

          if (parsed.tool_name || parsed.toolName) {
            const toolName = parsed.tool_name || parsed.toolName;
            const toolResult: FeloToolResult = { toolName };

            if (parsed.title) toolResult.title = parsed.title;
            if (parsed.status) toolResult.status = parsed.status;

            if (toolName === "generate_images" && parsed.urls) {
              toolResult.urls = parsed.urls;
            } else if (toolName === "generate_images" && parsed.images) {
              toolResult.urls = parsed.images.map(
                (img: { url?: string }) => img.url,
              ).filter(Boolean);
            }

            toolResults.push(toolResult);
          }
        } catch {
          if (data && !data.startsWith("{") && !data.startsWith("[")) {
            text += data;
          }
        }
      }
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
