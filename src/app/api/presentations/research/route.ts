// dashboard/src/app/api/presentations/research/route.ts
//
// Deep research endpoint: queries Felo for web search results,
// then synthesizes them via Claude into a presentation-ready markdown summary.

import { NextRequest } from "next/server";
import { getLLMProvider } from "@/lib/llm-provider";
import { feloSearch } from "@/lib/felo/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { query } = await req.json();

  if (!query || typeof query !== "string") {
    return Response.json({ error: "query is required" }, { status: 400 });
  }

  // Step 1: Call Felo Search API
  let feloAnswer = "";
  let feloResources: Array<{ title?: string; link?: string; snippet?: string }> = [];

  try {
    const result = await feloSearch(query);
    feloAnswer = result.answer;
    feloResources = result.resources;
  } catch (e) {
    return Response.json(
      { error: `Felo search failed: ${e instanceof Error ? e.message : e}` },
      { status: 502 },
    );
  }

  // Step 2: Use Claude Sonnet to synthesize into presentation-ready format
  const resourcesText = feloResources
    .map(
      (r) =>
        `- [${r.title || "Untitled"}](${r.link || ""}): ${r.snippet || ""}`,
    )
    .join("\n");

  const synthesisPrompt = `根據以下搜尋結果，整理成適合用於簡報的結構化研究摘要。

<search-query>${query}</search-query>

<search-answer>
${feloAnswer}
</search-answer>

<search-resources>
${resourcesText}
</search-resources>

請用以下格式輸出（語言與搜尋主題相同）：

# 研究：${query}

## 重點摘要
- （3-5 個 bullet points，每個 1-2 句）

## 關鍵數據
- （如有數字、統計、百分比，列出）

## 重要引述
- （如有值得引用的觀點）

## 來源
- [標題](URL)

只輸出上述格式的 markdown，不要加其他說明。`;

  const provider = getLLMProvider();

  let accumulated = "";
  try {
    for await (const event of provider.stream({
      prompt: synthesisPrompt,
      model: "sonnet",
      stdinPrompt: true,
      noMcp: true,
      noVault: true,
    })) {
      if (event.type === "text" && event.text) {
        accumulated += event.text;
      } else if (event.type === "error") {
        console.error("[research] stream error:", event.error);
      }
    }
  } catch (e) {
    return Response.json(
      { error: `LLM synthesis failed: ${e}` },
      { status: 500 },
    );
  }

  const synthesizedMarkdown = accumulated.trim();
  if (!synthesizedMarkdown) {
    return Response.json(
      { error: "Empty response from LLM" },
      { status: 500 },
    );
  }

  // Build sources array from Felo resources
  const sources = feloResources.map((r) => ({
    title: r.title || "",
    url: r.link || "",
  }));

  return Response.json({ content: synthesizedMarkdown, sources });
}
