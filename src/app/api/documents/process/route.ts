// dashboard/src/app/api/documents/process/route.ts
//
// Architecture: Do NOT read file contents ourselves. Pass file paths
// to Claude Code and let it use its native Read tool (supports PDF,
// images, binary, etc). We just orchestrate the session.
import { NextRequest } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join, resolve } from "path";
import { cleanClaudeOutput } from "@/lib/documents-utils";
import { getLLMProvider } from "@/lib/llm-provider";
import { markdownToDocx, markdownToPdfHtml, markdownToXlsx } from "@/lib/document-converters";
import { PATHS, expandHome } from "@/config/paths-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ProcessRequest {
  sources: Array<{ path: string; name: string; isDirectory: boolean }>;
  taskDescription: string;
  outputFormats: string[];
  outputPath: string;
  claudeSessionId?: string | null;
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

    prompt = [
      "你是 CycloneOS Documents 工作站的 AI 助手。",
      "使用者提供了以下檔案，請用 Read 工具讀取它們的內容：",
      "",
      fileList,
      "",
      "請先讀取所有檔案，然後回應使用者的需求。",
      "",
      `使用者需求：${taskDescription || "請讀取這些檔案，告訴我它們的內容摘要。"}`,
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
  const shouldSaveDocx = outputFormats?.includes("docx") && outputPath;
  const shouldSavePdf = outputFormats?.includes("pdf") && outputPath;
  const shouldSaveXlsx = outputFormats?.includes("xlsx") && outputPath;

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

        if (shouldSaveDocx) {
          try {
            await mkdir(outDir, { recursive: true });
            const docxBuf = await markdownToDocx(cleaned);
            const filePath = join(outDir, `output-${ts}.docx`);
            await writeFile(filePath, docxBuf);
            send("saved", "", { path: filePath });
          } catch (e) {
            send("error", `DOCX save failed: ${e instanceof Error ? e.message : "unknown"}`);
          }
        }

        if (shouldSavePdf) {
          try {
            await mkdir(outDir, { recursive: true });
            const pdfHtml = await markdownToPdfHtml(cleaned);
            const filePath = join(outDir, `output-${ts}-print.html`);
            await writeFile(filePath, pdfHtml, "utf-8");
            send("saved", "", { path: filePath, note: "開啟後按 Ctrl+P / Cmd+P 列印為 PDF" });
          } catch (e) {
            send("error", `PDF save failed: ${e instanceof Error ? e.message : "unknown"}`);
          }
        }

        if (shouldSaveXlsx) {
          try {
            await mkdir(outDir, { recursive: true });
            const xlsxBuf = await markdownToXlsx(cleaned);
            const filePath = join(outDir, `output-${ts}.xlsx`);
            await writeFile(filePath, xlsxBuf);
            send("saved", "", { path: filePath });
          } catch (e) {
            send("error", `XLSX save failed: ${e instanceof Error ? e.message : "unknown"}`);
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
