// dashboard/src/app/api/presentations/refine/route.ts
import { cleanClaudeOutput, fixJsonControlChars, repairTruncatedJson } from "@/lib/documents-utils";
import { getLLMProvider } from "@/lib/llm-provider";
import { getPlugin, getAllPlugins } from "@/lib/slide-templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Per-slide generation (non-SSE, returns JSON)
// ---------------------------------------------------------------------------

type PerSlideAction = "generate-notes" | "generate-image-prompt";

function buildPerSlidePrompt(
  action: PerSlideAction,
  slideContent: unknown,
  presentationTitle: string,
): string {
  const slideJson = JSON.stringify(slideContent, null, 2);

  if (action === "generate-notes") {
    return `You are a presentation speaking coach. Write what the presenter should SAY while this slide is on screen.

<slide-content>
${slideJson}
</slide-content>

<presentation-title>${presentationTitle}</presentation-title>

Rules:
- NEVER repeat text that's already on the slide
- Write supplementary explanations, background stories, extended details
- Include transition phrases (e.g., "接下來我們來看...")
- Include audience interaction cues (e.g., "大家有沒有遇過...")
- Natural, conversational tone — like talking to people
- Length: 3-5 sentences
- Language: match the slide content language

Respond with ONLY the speaker notes text. No JSON. No markdown. No formatting.`;
  }

  // generate-image-prompt
  return `Based on this slide's topic, generate an English image description suitable for a background or supplementary image.

<slide-content>
${slideJson}
</slide-content>

<presentation-title>${presentationTitle}</presentation-title>

Style: professional, modern, clean. No text elements.
Abstract or contextual imagery that supports the slide's message.
One paragraph, 2-3 sentences.

Respond with ONLY the image description. No JSON. No formatting.`;
}

async function handlePerSlideGeneration(
  action: PerSlideAction,
  slideId: string,
  slideContent: unknown,
  presentationTitle: string,
): Promise<Response> {
  const prompt = buildPerSlidePrompt(action, slideContent, presentationTitle);
  const provider = getLLMProvider();

  let accumulated = "";
  try {
    for await (const event of provider.stream({
      prompt,
      model: "sonnet",
      stdinPrompt: true,
      noMcp: true,
      noVault: true,
    })) {
      if (event.type === "text" && event.text) {
        accumulated += event.text;
      } else if (event.type === "error") {
        console.error("[per-slide-gen] stream error:", event.error);
      }
    }
  } catch (e) {
    return Response.json(
      { error: `Generation failed: ${e}` },
      { status: 500 },
    );
  }

  const result = accumulated.trim();
  if (!result) {
    return Response.json(
      { error: "Empty response from LLM" },
      { status: 500 },
    );
  }

  if (action === "generate-notes") {
    return Response.json({ slideId, speakerNotes: result });
  }
  return Response.json({ slideId, imagePrompt: result });
}

// ---------------------------------------------------------------------------
// Refine prompt builder (SSE-based outline editing)
// ---------------------------------------------------------------------------

function buildRefinePrompt(
  outlineJson: string,
  userMessage: string,
  targetSlideId?: string,
) {
  const availableTypes = getAllPlugins().map(p => p.type).join(", ");
  const variantsList = getAllPlugins()
    .map(p => `  ${p.type}(${p.variants.map(v => v.id).join(",")})`)
    .join("\n");

  return `<role>You are a JSON-only presentation editor. You MUST respond with ONLY a JSON object. No text before or after. No markdown fences. No explanation.</role>

<current-outline>
${outlineJson}
</current-outline>

${targetSlideId ? `<target-slide>The user is referring to slide with id "${targetSlideId}". Focus changes on that slide unless the instruction clearly applies to the whole presentation.</target-slide>` : ""}

<instruction>${userMessage}</instruction>

<rules>
- Apply the user's instruction to modify the outline
- Return the COMPLETE modified outline (all slides, not just changed ones)
- Keep the same JSON structure: {"title":"...","theme":"...","slides":[...]}
- Preserve slide IDs — do not change existing slide IDs
- If adding new slides, generate new UUID-style IDs
- Only change what the user asked for — preserve everything else
- Match the language of the user's instruction
- Available slideTypes: ${availableTypes}
- Available variants per type:
${variantsList}
- Sequential content (steps, lists, features) MUST use items[] array, NOT body. Reserve body for prose paragraphs only
- Every slide MUST include imagePrompt (English description of suitable illustration)
- Preserve existing imagePrompt values unless the slide content changed significantly
</rules>

<format>Respond with ONLY the complete modified JSON outline.</format>`;
}

export async function POST(request: Request) {
  const body = await request.json();
  const { action, slideId, slideContent, presentationTitle } = body;

  // --- Per-slide generation (non-SSE) ---
  if (action === "generate-notes" || action === "generate-image-prompt") {
    if (!slideId || !slideContent) {
      return Response.json(
        { error: "Missing slideId or slideContent" },
        { status: 400 },
      );
    }
    return handlePerSlideGeneration(
      action as PerSlideAction,
      slideId,
      slideContent,
      presentationTitle || "Untitled Presentation",
    );
  }

  // --- SSE-based outline refine ---
  const { outline, message, targetSlideId, claudeSessionId } = body;

  if (!outline || !message) {
    return Response.json(
      { error: "Missing outline or message" },
      { status: 400 },
    );
  }

  const outlineJson = JSON.stringify(outline, null, 2);
  const prompt = buildRefinePrompt(outlineJson, message, targetSlideId);

  const provider = getLLMProvider();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      let accumulated = "";
      let sessionId = claudeSessionId || "";

      try {
        for await (const event of provider.stream({
          prompt,
          model: "sonnet",
          stdinPrompt: true,
          noMcp: true,
          noVault: true,
          sessionId: claudeSessionId || undefined,
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

      if (accumulated) {
        try {
          const cleaned = fixJsonControlChars(cleanClaudeOutput(accumulated));
          let newOutline = null;

          const tryParse = (text: string) => {
            try { return JSON.parse(text); } catch { return null; }
          };

          newOutline = tryParse(cleaned.trim());

          if (!newOutline) {
            const fenceStripped = cleaned
              .replace(/^```(?:json)?\s*\n?/m, "")
              .replace(/\n?```\s*$/m, "")
              .trim();
            newOutline = tryParse(fenceStripped);
          }

          if (!newOutline) {
            const fenceMatch = cleaned.match(/```json\s*\n([\s\S]*?)\n```/);
            if (fenceMatch) {
              newOutline = tryParse(fenceMatch[1].trim())
                ?? tryParse(repairTruncatedJson(fenceMatch[1].trim()));
            }
          }

          if (!newOutline) {
            try {
              JSON.parse(cleaned);
            } catch (parseErr) {
              if (parseErr instanceof SyntaxError) {
                const posMatch = parseErr.message.match(/position (\d+)/);
                if (posMatch) {
                  const prefix = cleaned.slice(0, parseInt(posMatch[1]));
                  newOutline = tryParse(repairTruncatedJson(prefix));
                }
              }
            }
          }

          if (!newOutline) {
            newOutline = tryParse(repairTruncatedJson(cleaned.trim()));
          }

          if (newOutline && newOutline.title && newOutline.slides) {
            for (const slide of newOutline.slides) {
              if (!slide.content) {
                slide.content = {
                  slideType: "content", variant: "bullets",
                  title: `Slide ${slide.order + 1}`,
                };
              }
              if (!getPlugin(slide.content.slideType)) {
                slide.content.slideType = "content";
              }
              if (!slide.content.variant) {
                const resolvedPlugin = getPlugin(slide.content.slideType);
                slide.content.variant = resolvedPlugin?.defaultVariant ?? "bullets";
              }
            }

            send("outline", { outline: newOutline, sessionId });
            send("assistant", { content: "已更新簡報大綱。" });
          } else {
            send("assistant", {
              content:
                cleaned.substring(0, 500) ||
                "無法解析回應，請重新描述您的修改需求。",
            });
          }
        } catch (e) {
          send("error", { message: `Failed to parse response: ${e}` });
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
