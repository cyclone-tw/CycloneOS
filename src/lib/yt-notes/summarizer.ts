import { getLLMProvider } from "@/lib/llm-provider";
import { buildSummaryPrompt } from "./prompts";
import type { VideoMeta } from "./types";
import type { AgentCliProvider } from "@/types/chat";

export interface SummaryResult {
  summaryMarkdown: string;
  topics: string[];
}

/** Generate summary using LLM provider */
export async function generateSummary(
  meta: VideoMeta,
  transcript: string,
  options?: { provider?: AgentCliProvider; model?: string }
): Promise<SummaryResult> {
  const provider = getLLMProvider(options?.provider);
  const prompt = buildSummaryPrompt(meta, transcript);

  let fullText = "";
  for await (const event of provider.stream({
    prompt,
    model: options?.model,
    stdinPrompt: true,
    noMcp: true,
    noVault: true,
    permissionMode: "default",
    appendSystemPrompt: "你是影片摘要分析師。只輸出摘要內容，不要加任何前言或解釋。",
  })) {
    if (event.type === "text" && event.text) {
      fullText += event.text;
    }
    if (event.type === "error") {
      console.error("[summarizer] LLM error:", event.error);
    }
  }

  const topics = extractTopics(fullText);
  const summaryMarkdown = fullText
    .replace(/\n*TOPICS_JSON:\[.*\]\s*$/, "")
    .trim();

  return { summaryMarkdown, topics };
}

function extractTopics(text: string): string[] {
  const match = text.match(/TOPICS_JSON:\s*(\[.*\])/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[1]);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    // Parse error
  }
  return [];
}
