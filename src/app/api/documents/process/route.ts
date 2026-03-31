// dashboard/src/app/api/documents/process/route.ts
//
// Architecture: Do NOT read file contents ourselves. Pass file paths
// to Claude Code and let it use its native Read tool (supports PDF,
// images, binary, etc). We just orchestrate the session.
import { NextRequest } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join, resolve } from "path";
import { homedir } from "os";
import { cleanClaudeOutput } from "@/lib/documents-utils";
import { getLLMProvider } from "@/lib/llm-provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function expandHome(p: string): string {
  if (p.startsWith("~/") || p === "~") return join(homedir(), p.slice(1));
  return p;
}

interface ProcessRequest {
  sources: Array<{ path: string; name: string; isDirectory: boolean }>;
  taskDescription: string;
  outputFormats: string[];
  outputPath: string;
  claudeSessionId?: string | null;
}

function markdownToRevealHtml(markdown: string, title?: string): string {
  // Split by H1/H2 headings to create slides
  const slides = markdown
    .split(/\n(?=^#{1,2}\s)/m)
    .filter((s) => s.trim())
    .map((slide) => {
      // Strip trailing --- (horizontal rules) that Claude adds as separators;
      // reveal.js treats --- as slide separators, causing blank pages
      const clean = slide.trim().replace(/\n---\s*$/, "").trim();
      return `<section data-markdown data-separator="^\\n---NOSPLIT---\\n$"><textarea data-template>\n${clean}\n</textarea></section>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title || "簡報"}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/theme/black.css">
<style>
  .reveal { font-size: 32px; }
  .reveal h1 { font-size: 2em; }
  .reveal h2 { font-size: 1.6em; }
  .reveal section { text-align: left; }
  .reveal ul, .reveal ol { display: block; margin-left: 1em; }
</style>
</head>
<body>
<div class="reveal">
<div class="slides">
${slides}
</div>
</div>
<script src="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.js"><\/script>
<script src="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/plugin/markdown/markdown.js"><\/script>
<script>
Reveal.initialize({
  hash: true,
  plugins: [RevealMarkdown],
  markdown: { smartypants: true }
});
<\/script>
</body>
</html>`;
}

export async function POST(request: NextRequest) {
  let body: ProcessRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { sources, taskDescription, outputFormats, outputPath, claudeSessionId } = body;

  if (!sources?.length) {
    return Response.json({ error: "No sources provided" }, { status: 400 });
  }

  // Build prompt — give Claude file PATHS, not contents
  let prompt: string;

  if (claudeSessionId) {
    // Resuming session — files already in context
    prompt = taskDescription;
  } else {
    // First message — tell Claude about the files
    const fileList = sources
      .map((src) => `- ${src.name}: ${resolve(expandHome(src.path))}`)
      .join("\n");

    // Format-specific instructions
    const isSlides = outputFormats?.includes("html-slides");
    const formatHint = isSlides
      ? [
          "",
          "輸出格式要求（簡報模式）：",
          "- 用 Markdown 格式輸出（不要生成 HTML）",
          "- 用 ## 標題分隔每一張投影片",
          "- 每張投影片控制在 3-5 個要點",
          "- 第一張投影片是標題頁（用 # 大標題）",
          "- 保持簡潔，適合投影呈現",
        ].join("\n")
      : "";

    prompt = [
      "你是 CycloneOS Documents 工作站的 AI 助手。",
      "使用者提供了以下檔案，請用 Read 工具讀取它們的內容：",
      "",
      fileList,
      "",
      "請先讀取所有檔案，然後回應使用者的需求。",
      "",
      `使用者需求：${taskDescription || "請讀取這些檔案，告訴我它們的內容摘要。"}`,
      formatHint,
      "",
      "規則：",
      "- 用繁體中文回答",
      "- 如果是 PDF，用 Read 工具讀取（它支援 PDF）",
      "- 簡潔扼要地回答",
      "- 永遠只輸出 Markdown 文字，不要生成 HTML 代碼",
      "- 不要用 Write 工具寫檔案",
      "- 不要在回覆末尾加任何附註",
    ].join("\n");
  }

  const provider = getLLMProvider();
  const shouldSaveMd = outputFormats?.includes("md") && outputPath;
  const shouldSaveSlides = outputFormats?.includes("html-slides") && outputPath;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (type: string, content: string, extra?: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, content, ...extra })}\n\n`));
      };

      let fullContent = "";

      try {
        for await (const event of provider.stream({
          prompt,
          model: "sonnet",
          stdinPrompt: true,
          noMcp: true,
          noVault: true,
          permissionMode: "bypassPermissions",
          disallowedTools: ["Write", "Edit", "Bash", "NotebookEdit"],
          sessionId: claudeSessionId || undefined,
        })) {
          switch (event.type) {
            case "session":
              send("session", "", { sessionId: event.sessionId });
              break;
            case "text":
              fullContent += event.text!;
              send("text", event.text!);
              break;
            case "error":
              console.error("[documents/process]", event.error);
              send("error", event.error!);
              break;
          }
        }
      } catch (e) {
        send("error", `Stream error: ${e}`);
      }

      // Save outputs
      const cleaned = cleanClaudeOutput(fullContent);
      if (cleaned && outputPath) {
        const outDir = resolve(expandHome(outputPath));
        const ts = Date.now();

        if (shouldSaveMd) {
          try {
            await mkdir(outDir, { recursive: true });
            const filePath = join(outDir, `output-${ts}.md`);
            await writeFile(filePath, cleaned, "utf-8");
            send("saved", "", { path: filePath });
          } catch (e) {
            send("error", `MD save failed: ${e instanceof Error ? e.message : "unknown"}`);
          }
        }

        if (shouldSaveSlides) {
          try {
            await mkdir(outDir, { recursive: true });
            const filePath = join(outDir, `slides-${ts}.html`);
            await writeFile(filePath, markdownToRevealHtml(cleaned), "utf-8");
            send("saved", "", { path: filePath });
          } catch (e) {
            send("error", `HTML save failed: ${e instanceof Error ? e.message : "unknown"}`);
          }
        }
      }

      send("done", "");
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
