"use client";
import { useState, useCallback } from "react";
import { usePresentationsStore, type SlideDefinition, type SlideType } from "@/stores/presentations-store";
import { getAllPlugins, getPlugin, getTemplateFields } from "@/lib/slide-templates";
import { FieldRenderer } from "./field-renderer";
import { Trash2, Loader2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Derive SLIDE_TYPES and variants from the plugin registry
// ---------------------------------------------------------------------------

const SLIDE_TYPES = getAllPlugins().map((p) => ({
  value: p.type as SlideType,
  label: p.label,
  icon: p.icon,
}));

function getVariants(slideType: string) {
  const plugin = getPlugin(slideType);
  return plugin?.variants.map((v) => ({ value: v.id, label: v.label })) ?? [];
}

// ---------------------------------------------------------------------------
// ContentEditor — driven entirely by FieldConfig from plugins
// ---------------------------------------------------------------------------

function ContentEditor({ slide }: { slide: SlideDefinition }) {
  const fields = getTemplateFields(slide.content.slideType);
  return (
    <div className="space-y-3 mt-4">
      {fields.map((field) => (
        <FieldRenderer key={field.key} field={field} slide={slide} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SlideGenerationButtons — per-slide AI generation for notes & image prompts
// ---------------------------------------------------------------------------

function SlideGenerationButtons({ slide }: { slide: SlideDefinition }) {
  const { updateSlideField, updateSlideContent, getActiveSession } =
    usePresentationsStore();

  const [loadingNotes, setLoadingNotes] = useState(false);
  const [loadingImage, setLoadingImage] = useState(false);
  const [loadingGenImage, setLoadingGenImage] = useState(false);

  const presentationTitle =
    getActiveSession()?.outline?.title || "Untitled Presentation";

  const hasSpeakerNotes = !!slide.speakerNotes?.trim();
  const hasImagePrompt = !!slide.content.imagePrompt?.trim();

  const generate = useCallback(
    async (action: "generate-notes" | "generate-image-prompt") => {
      const isNotes = action === "generate-notes";
      const setLoading = isNotes ? setLoadingNotes : setLoadingImage;
      setLoading(true);

      try {
        const res = await fetch("/api/presentations/refine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            slideId: slide.id,
            slideContent: slide.content,
            presentationTitle,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Unknown error" }));
          console.error("[SlideGenerationButtons]", err.error);
          return;
        }

        const data = await res.json();

        if (isNotes && data.speakerNotes) {
          updateSlideField(slide.id, "speakerNotes", data.speakerNotes);
        } else if (!isNotes && data.imagePrompt) {
          updateSlideContent(slide.id, { imagePrompt: data.imagePrompt });
        }
      } catch (e) {
        console.error("[SlideGenerationButtons] fetch failed:", e);
      } finally {
        setLoading(false);
      }
    },
    [slide.id, slide.content, presentationTitle, updateSlideField, updateSlideContent],
  );

  const handleGenerateImage = useCallback(async () => {
    const prompt = slide.content.imagePrompt?.trim();
    if (!prompt) return;
    setLoadingGenImage(true);

    try {
      const res = await fetch("/api/presentations/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagePrompt: prompt }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        console.error("[GenerateImage]", err.error);
        return;
      }

      const data = await res.json();
      if (data.localPath) {
        updateSlideContent(slide.id, { backgroundImage: data.localPath });
      }
    } catch (e) {
      console.error("[GenerateImage] fetch failed:", e);
    } finally {
      setLoadingGenImage(false);
    }
  }, [slide.id, slide.content.imagePrompt, updateSlideContent]);

  return (
    <div className="space-y-3">
      {/* Speaker Notes */}
      <div>
        <button
          onClick={() => generate("generate-notes")}
          disabled={loadingNotes}
          className="w-full flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium bg-zinc-700/60 hover:bg-zinc-700/80 text-cy-text border border-zinc-600/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loadingNotes ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : null}
          {hasSpeakerNotes ? "重新生成講稿" : "生成講稿"}
        </button>
        {hasSpeakerNotes && (
          <textarea
            value={slide.speakerNotes ?? ""}
            onChange={(e) =>
              updateSlideField(slide.id, "speakerNotes", e.target.value)
            }
            rows={3}
            className="mt-1.5 w-full rounded-md bg-cy-input/30 border border-cy-border px-2 py-1.5 text-xs text-cy-text placeholder:text-cy-muted/50 resize-y"
            placeholder="講稿..."
          />
        )}
      </div>

      {/* Image Prompt */}
      <div>
        <button
          onClick={() => generate("generate-image-prompt")}
          disabled={loadingImage}
          className="w-full flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium bg-zinc-700/60 hover:bg-zinc-700/80 text-cy-text border border-zinc-600/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loadingImage ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : null}
          {hasImagePrompt ? "重新生成圖片提示" : "生成圖片提示"}
        </button>
        {hasImagePrompt && (
          <textarea
            value={slide.content.imagePrompt ?? ""}
            onChange={(e) =>
              updateSlideContent(slide.id, { imagePrompt: e.target.value })
            }
            rows={3}
            className="mt-1.5 w-full rounded-md bg-cy-input/30 border border-cy-border px-2 py-1.5 text-xs text-cy-text placeholder:text-cy-muted/50 resize-y"
            placeholder="Image prompt..."
          />
        )}
        {hasImagePrompt && (
          <button
            onClick={handleGenerateImage}
            disabled={loadingGenImage}
            className="mt-1.5 w-full flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium bg-purple-600/80 hover:bg-purple-600 text-white border border-purple-500/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingGenImage ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : null}
            {loadingGenImage ? "生圖中..." : "🎨 用此提示生圖"}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SlideLayoutEditor — main exported component
// ---------------------------------------------------------------------------

interface SlideLayoutEditorProps {
  slide: SlideDefinition;
}

export function SlideLayoutEditor({ slide }: SlideLayoutEditorProps) {
  const { setSlideLayout, deleteSlide } = usePresentationsStore();
  const currentType = slide.content.slideType;
  const currentVariant = slide.content.variant;
  const variants = getVariants(currentType);

  return (
    <div className="space-y-3">
      {/* SlideType selector */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-cy-muted">版面類型</label>
          <button
            onClick={() => deleteSlide(slide.id)}
            className="text-cy-error hover:text-cy-error/80 transition-colors"
            title="刪除投影片"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {SLIDE_TYPES.map((st) => {
            const stVariants = getVariants(st.value);
            const defaultVariant = stVariants[0]?.value ?? "";
            return (
              <button
                key={st.value}
                onClick={() => setSlideLayout(slide.id, st.value, defaultVariant)}
                className={`flex flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-center transition-colors ${
                  currentType === st.value
                    ? "bg-cy-accent/15 border border-cy-accent/30 text-cy-accent"
                    : "bg-cy-input/30 border border-transparent hover:bg-cy-input/50 text-cy-text"
                }`}
              >
                <span className="text-sm">{st.icon}</span>
                <span className="text-[10px] leading-tight">{st.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Variant selector */}
      {variants.length > 0 && (
        <div>
          <label className="text-xs text-cy-muted block mb-1">變體</label>
          <div className="flex flex-wrap gap-1">
            {variants.map((v) => (
              <button
                key={v.value}
                onClick={() => setSlideLayout(slide.id, currentType, v.value)}
                className={`rounded-md px-2 py-1 text-xs transition-colors ${
                  currentVariant === v.value
                    ? "bg-cy-accent/15 text-cy-accent border border-cy-accent/30"
                    : "bg-cy-input/30 text-cy-muted border border-transparent hover:bg-cy-input/50"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content editor */}
      <div className="border-t border-cy-border pt-2">
        <ContentEditor slide={slide} />
      </div>

      {/* Per-slide AI generation */}
      <div className="border-t border-cy-border pt-3">
        <label className="text-xs font-medium text-cy-muted block mb-2">
          AI 輔助生成
        </label>
        <SlideGenerationButtons slide={slide} />
      </div>
    </div>
  );
}
