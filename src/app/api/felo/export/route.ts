// src/app/api/felo/export/route.ts
//
// Export Felo chat content to file formats (MD, DOCX, XLSX).
// Takes a message content + optional user instruction,
// processes via LLM if needed, converts and saves.

import { NextRequest } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join, resolve } from "path";
import { getLLMProvider } from "@/lib/llm-provider";
import { markdownToDocx, markdownToXlsx } from "@/lib/document-converters";
import { PATHS, generateFileName, extractSummary } from "@/config/paths-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { content, format, instruction, outputPath } = await req.json();

  if (!content || typeof content !== "string") {
    return Response.json({ error: "content is required" }, { status: 400 });
  }

  if (!format || !["md", "docx", "xlsx"].includes(format)) {
    return Response.json({ error: "format must be md, docx, or xlsx" }, { status: 400 });
  }

  try {
    let processed = content;

    // If user gave a custom instruction, let LLM process the content first
    if (instruction && instruction.trim()) {
      const provider = getLLMProvider();
      const prompt = `以下是一段內容：

<content>
${content}
</content>

使用者的要求：${instruction}

請根據使用者的要求處理上述內容，只輸出處理後的結果，不要加任何額外說明。用繁體中文。`;

      let result = "";
      for await (const event of provider.stream({
        prompt,
        model: "sonnet",
        stdinPrompt: true,
        noMcp: true,
        noVault: true,
      })) {
        if (event.type === "text" && event.text) {
          result += event.text;
        }
      }
      processed = result.trim() || content;
    }

    const summary = extractSummary(processed);
    let filePath: string;
    let fileName: string;

    switch (format) {
      case "md": {
        fileName = generateFileName("felo", summary);
        const outDir = resolve(PATHS.markdownOutputs);
        await mkdir(outDir, { recursive: true });
        filePath = join(outDir, fileName);
        await writeFile(filePath, processed, "utf-8");
        break;
      }
      case "docx": {
        fileName = generateFileName("felo", summary, "docx");
        const outDir = resolve(outputPath || PATHS.documents);
        await mkdir(outDir, { recursive: true });
        filePath = join(outDir, fileName);
        const docxBuf = await markdownToDocx(processed);
        await writeFile(filePath, docxBuf);
        break;
      }
      case "xlsx": {
        fileName = generateFileName("felo", summary, "xlsx");
        const outDir = resolve(outputPath || PATHS.documents);
        await mkdir(outDir, { recursive: true });
        filePath = join(outDir, fileName);
        const xlsxBuf = await markdownToXlsx(processed);
        await writeFile(filePath, xlsxBuf);
        break;
      }
      default:
        return Response.json({ error: "Unknown format" }, { status: 400 });
    }

    return Response.json({ path: filePath, fileName, format });
  } catch (e) {
    console.error("[felo/export] error:", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "Export failed" },
      { status: 500 },
    );
  }
}
