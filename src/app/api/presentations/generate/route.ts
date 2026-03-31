// dashboard/src/app/api/presentations/generate/route.ts
import { execSync } from "child_process";
import { readFile } from "fs/promises";
import { cleanClaudeOutput, fixJsonControlChars, repairTruncatedJson } from "@/lib/documents-utils";
import { getLLMProvider } from "@/lib/llm-provider";
import { buildPromptDecisionTree, buildContentFieldsTable, getPlugin } from "@/lib/slide-templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Read source contents server-side and embed in prompt.
 *  Sources with textContent (text/research) use it directly; file sources read from disk.
 *  Supports text files (.md, .txt, .csv, etc.) and PDF files. */
async function readSourceContents(
  sources: Array<{ path: string; textContent?: string; type?: string; name?: string }>,
): Promise<string> {
  if (sources.length === 0) return "";
  const parts: string[] = [];
  for (const source of sources) {
    const label = source.name || source.path;
    try {
      let content: string;
      if (source.textContent) {
        // Text/research sources: use provided content directly
        content = source.textContent;
      } else if (source.path.toLowerCase().endsWith(".pdf")) {
        // Extract text from PDF using system pdftotext (poppler)
        content = execSync(`pdftotext "${source.path}" -`, { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
      } else {
        content = await readFile(source.path, "utf-8");
      }
      // Truncate very large files to avoid token overflow
      const truncated = content.length > 60000 ? content.slice(0, 60000) + "\n...(truncated)" : content;
      parts.push(`<file path="${label}">\n${truncated}\n</file>`);
    } catch (e) {
      parts.push(`<file path="${label}" error="Cannot read: ${e instanceof Error ? e.message : 'unknown error'}" />`);
    }
  }
  return `<sources>\n${parts.join("\n")}\n</sources>`;
}

const SLIDE_OUTLINE_PROMPT = (
  sourceContent: string,
  instructions: string,
  themeName?: string,
  themePrompt?: string,
) => `<role>You are a presentation outline generator that creates slides STRICTLY from provided source material. You MUST respond with ONLY a JSON object. No text before or after the JSON. No explanation. No markdown fences.</role>

${sourceContent}

<task>${instructions || "Create a professional presentation based on the source material."}</task>

<CRITICAL-RULES>
## Content Fidelity (MANDATORY)

1. **ONLY use content from <sources>** — every fact, quote, number, and example in your slides MUST come directly from the source material
2. **NEVER fabricate data** — if the source doesn't contain statistics, percentages, or numbers, do NOT invent them. Use content/story-cards slides instead of dataviz
3. **NEVER use your general AI knowledge** — even if you know more about the topic, only use what the source provides
4. **Preserve specific examples** — if the source gives concrete examples, use those exact examples, not generic versions
5. **Use actual quotes** — if the source contains notable quotes, use them verbatim in quote slides
6. **Empty fields are forbidden** — every items[], columns[], cards[] must have actual text content. If you don't have content for a field, don't use that slide type

## Before generating slides, mentally extract from the source:
- Section headings and structure
- Key arguments and claims (with supporting details)
- Specific examples and case studies
- Actual data, numbers, statistics (if any)
- Notable quotes with attribution
- Comparisons and contrasts
- Conclusions and takeaways
</CRITICAL-RULES>

<content-structure>
## Content Structure Rules

7. **Sequential content MUST use items[]** — steps, processes, lists, comparisons, features → always use items[{label, desc}], NEVER put numbered lists (1. 2. 3.) inside body
8. **Reserve body for narrative paragraphs only** — body is for prose text, not structured content
9. **Do NOT include imagePrompt** — image prompts will be generated separately
</content-structure>

<slide-types>
${buildPromptDecisionTree()}
</slide-types>

<content-fields>
${buildContentFieldsTable()}
- imagePrompt (string): DO NOT include — will be generated separately
</content-fields>

<speaker-notes>
Do NOT include speakerNotes in the initial generation — they will be generated separately.
</speaker-notes>

${themeName ? `<theme>${themeName} — ${themePrompt ?? ""}</theme>` : ""}

<format>Respond with ONLY this JSON structure:
{"title":"string","slides":[{"id":"1","order":0,"content":{"slideType":"cover","variant":"gradient","title":"..."}}]}

Rules:
- Slide count should match source depth — don't pad with filler
- Pack related content into ONE slide
- Each slide must have substantial content from the source
- Vary slide types — don't repeat the same type 3+ times in a row
- Content language: match source language
- Every text field must contain actual content from the source
</format>`;

export async function POST(request: Request) {
  const { sources = [], instructions = "", theme } = await request.json();

  // Import getThemeById to resolve theme info for the prompt
  const { getThemeById } = await import("@/lib/presentation-themes");
  const themeObj = theme ? getThemeById(theme) : undefined;

  // Read source contents server-side (avoids Claude CLI file access issues)
  const sourceContent = await readSourceContents(sources);

  const prompt = SLIDE_OUTLINE_PROMPT(
    sourceContent,
    instructions,
    themeObj?.name,
    themeObj?.canvaStylePrompt,
  );

  const provider = getLLMProvider();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      let accumulated = "";
      let sessionId = "";

      try {
        for await (const event of provider.stream({
          prompt,
          model: "sonnet",
          stdinPrompt: true,
          noMcp: true,
          noVault: true,
        })) {
          switch (event.type) {
            case "session":
              sessionId = event.sessionId!;
              send("session", { sessionId });
              break;
            case "text":
              accumulated += event.text!;
              send("text", { text: event.text });
              break;
            case "error":
              send("error", { message: event.error });
              break;
          }
        }
      } catch (e) {
        send("error", { message: `Stream error: ${e}` });
      }

      // Parse the accumulated text as SlideOutline JSON
      if (accumulated) {
        try {
          const cleaned = fixJsonControlChars(cleanClaudeOutput(accumulated));
          let outline = null;

          // tryParse: attempt JSON.parse, return null on failure
          const tryParse = (text: string) => {
            try { return JSON.parse(text); } catch { return null; }
          };

          // Strategy 1: Direct parse
          outline = tryParse(cleaned.trim());

          // Strategy 2: Strip markdown fences
          if (!outline) {
            const fenceStripped = cleaned
              .replace(/^```(?:json)?\s*\n?/m, "")
              .replace(/\n?```\s*$/m, "")
              .trim();
            outline = tryParse(fenceStripped);
          }

          // Strategy 3: Extract first ```json ... ``` fenced block
          if (!outline) {
            const fenceMatch = cleaned.match(/```json\s*\n([\s\S]*?)\n```/);
            if (fenceMatch) {
              outline = tryParse(fenceMatch[1].trim());
              // If fenced block itself is truncated, try repair
              if (!outline) {
                outline = tryParse(repairTruncatedJson(fenceMatch[1].trim()));
              }
            }
          }

          // Strategy 4: Extract JSON prefix up to parse error, then repair
          // Handles: Claude outputs raw JSON, hits token limit, adds explanation text after
          if (!outline) {
            try {
              JSON.parse(cleaned);
            } catch (parseErr) {
              if (parseErr instanceof SyntaxError) {
                const posMatch = parseErr.message.match(/position (\d+)/);
                if (posMatch) {
                  const errorPos = parseInt(posMatch[1]);
                  const prefix = cleaned.slice(0, errorPos);
                  const repaired = repairTruncatedJson(prefix);
                  outline = tryParse(repaired);
                  if (outline) {
                    console.warn(`[generate] JSON truncated at pos ${errorPos}/${cleaned.length}, repaired (${outline.slides?.length ?? 0} slides)`);
                  }
                }
              }
            }
          }

          // Strategy 5: Full text repair (last resort)
          if (!outline) {
            outline = tryParse(repairTruncatedJson(cleaned.trim()));
          }

          if (outline && outline.title && outline.slides) {
            // Validate and normalize using plugin registry
            for (const slide of outline.slides) {
              slide.id = crypto.randomUUID();
              if (!slide.content) {
                slide.content = { slideType: "content", variant: "bullets", title: `Slide ${slide.order + 1}` };
              }
              const plugin = getPlugin(slide.content.slideType);
              if (!plugin) {
                slide.content.slideType = "content";
              }
              if (!slide.content.variant) {
                const resolvedPlugin = getPlugin(slide.content.slideType);
                slide.content.variant = resolvedPlugin?.defaultVariant ?? "bullets";
              }
            }

            send("outline", { outline, sessionId });
          } else {
            send("error", { message: `Claude did not return valid outline JSON. Response: ${cleaned.substring(0, 200)}...` });
          }
        } catch (e) {
          send("error", { message: `Failed to parse outline JSON: ${e}` });
        }
      }

      send("done", {});
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
