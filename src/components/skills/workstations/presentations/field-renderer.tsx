"use client";

import { usePresentationsStore, type SlideDefinition, type SlideContent, type ContentBlock, type ContentItem } from "@/stores/presentations-store";
import type { FieldConfig } from "@/lib/slide-templates";
import { Plus, X } from "lucide-react";

// ---------------------------------------------------------------------------
// Shared style classes
// ---------------------------------------------------------------------------

const INPUT_CLS =
  "w-full rounded-md bg-cy-input px-2 py-1.5 text-xs text-cy-text border border-cy-border focus:outline-none focus:border-cy-accent";

const INPUT_PLACEHOLDER_CLS = `${INPUT_CLS} placeholder:text-cy-muted/50`;

const TEXTAREA_CLS = `${INPUT_CLS} resize-none`;

const SMALL_INPUT_CLS =
  "rounded bg-cy-input px-1.5 py-1 text-xs text-cy-text border border-cy-border focus:outline-none focus:border-cy-accent";

// ---------------------------------------------------------------------------
// FieldRenderer
// ---------------------------------------------------------------------------

interface FieldRendererProps {
  field: FieldConfig;
  slide: SlideDefinition;
}

export function FieldRenderer({ field, slide }: FieldRendererProps) {
  const { updateSlideContent } = usePresentationsStore();
  const content = slide.content;

  const update = (updates: Partial<SlideContent>) => {
    updateSlideContent(slide.id, updates);
  };

  switch (field.type) {
    // -----------------------------------------------------------------------
    // text — single-line input
    // -----------------------------------------------------------------------
    case "text":
      return renderText(field, content, update);

    // -----------------------------------------------------------------------
    // textarea — multi-line text
    // -----------------------------------------------------------------------
    case "textarea":
      return renderTextarea(field, content, update);

    // -----------------------------------------------------------------------
    // items — line-separated with " — " delimiter for label|desc
    // -----------------------------------------------------------------------
    case "items":
      return renderItems(field, content, update);

    // -----------------------------------------------------------------------
    // cards — per-card icon / title / body editors
    // -----------------------------------------------------------------------
    case "cards":
      return renderCards(field, content, update);

    // -----------------------------------------------------------------------
    // columns — left/right column editors
    // -----------------------------------------------------------------------
    case "columns":
      return renderColumns(field, content, update);

    // -----------------------------------------------------------------------
    // images — multi-image URL input (1-4 images)
    // -----------------------------------------------------------------------
    case "images":
      return renderImages(field, content, update);

    // -----------------------------------------------------------------------
    // image — single image URL + fit selector
    // -----------------------------------------------------------------------
    case "image":
      return renderImage(field, content, update);

    // -----------------------------------------------------------------------
    // highlight-lines — checkbox per line of title text for accent marking
    // -----------------------------------------------------------------------
    case "highlight-lines":
      return renderHighlightLines(field, content, update);

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

type Updater = (updates: Partial<SlideContent>) => void;

function renderText(
  field: FieldConfig,
  content: SlideContent,
  update: Updater,
) {
  // Special: bigNumber is a compound {value, label} stored in content.bigNumber
  if (field.key === "bigNumber") {
    return (
      <div>
        <label className="text-xs text-cy-muted block mb-1">{field.label}</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={content.bigNumber?.value ?? ""}
            onChange={(e) =>
              update({
                bigNumber: {
                  value: e.target.value,
                  label: content.bigNumber?.label ?? "",
                },
              })
            }
            placeholder="數值"
            className={`w-24 ${SMALL_INPUT_CLS}`}
          />
          <input
            type="text"
            value={content.bigNumber?.label ?? ""}
            onChange={(e) =>
              update({
                bigNumber: {
                  value: content.bigNumber?.value ?? "",
                  label: e.target.value,
                },
              })
            }
            placeholder="標籤"
            className={`flex-1 ${SMALL_INPUT_CLS}`}
          />
        </div>
      </div>
    );
  }

  // Generic text field
  const value = (content as unknown as Record<string, unknown>)[field.key] as string | undefined;
  return (
    <div>
      <label className="text-xs text-cy-muted block mb-1">{field.label}</label>
      <input
        type="text"
        value={value ?? ""}
        onChange={(e) => update({ [field.key]: e.target.value })}
        placeholder={field.placeholder}
        className={INPUT_PLACEHOLDER_CLS}
      />
    </div>
  );
}

function renderTextarea(
  field: FieldConfig,
  content: SlideContent,
  update: Updater,
) {
  // Special: quote is a compound {text, author?, source?}
  if (field.key === "quote") {
    return (
      <div className="space-y-1.5">
        <label className="text-xs text-cy-muted block">{field.label}</label>
        <textarea
          value={content.quote?.text ?? ""}
          onChange={(e) =>
            update({ quote: { ...content.quote, text: e.target.value } })
          }
          rows={3}
          placeholder="引言內容"
          className={`${TEXTAREA_CLS} placeholder:text-cy-muted/50`}
        />
        <input
          type="text"
          value={content.quote?.author ?? ""}
          onChange={(e) =>
            update({
              quote: {
                ...content.quote,
                text: content.quote?.text ?? "",
                author: e.target.value,
              },
            })
          }
          placeholder="作者"
          className={INPUT_PLACEHOLDER_CLS}
        />
        <input
          type="text"
          value={content.quote?.source ?? ""}
          onChange={(e) =>
            update({
              quote: {
                ...content.quote,
                text: content.quote?.text ?? "",
                source: e.target.value,
              },
            })
          }
          placeholder="出處"
          className={INPUT_PLACEHOLDER_CLS}
        />
      </div>
    );
  }

  // Generic textarea
  const value = (content as unknown as Record<string, unknown>)[field.key] as string | undefined;
  return (
    <div>
      <label className="text-xs text-cy-muted block mb-1">{field.label}</label>
      <textarea
        value={value ?? ""}
        onChange={(e) => update({ [field.key]: e.target.value })}
        rows={3}
        placeholder={field.placeholder}
        className={`${TEXTAREA_CLS} placeholder:text-cy-muted/50`}
      />
    </div>
  );
}

function renderItems(
  field: FieldConfig,
  content: SlideContent,
  update: Updater,
) {
  // Special: stats items (value + label pairs)
  if (field.key === "stats") {
    const stats = content.stats ?? [];
    return (
      <div>
        <label className="text-xs text-cy-muted block mb-1">{field.label}</label>
        <div className="space-y-1">
          {stats.map((stat, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                value={stat.value}
                onChange={(e) => {
                  const newStats = [...stats];
                  newStats[i] = { ...newStats[i], value: e.target.value };
                  update({ stats: newStats });
                }}
                placeholder="數值"
                className={`w-24 ${SMALL_INPUT_CLS}`}
              />
              <input
                type="text"
                value={stat.label}
                onChange={(e) => {
                  const newStats = [...stats];
                  newStats[i] = { ...newStats[i], label: e.target.value };
                  update({ stats: newStats });
                }}
                placeholder="標籤"
                className={`flex-1 ${SMALL_INPUT_CLS}`}
              />
            </div>
          ))}
        </div>
        <button
          onClick={() =>
            update({ stats: [...stats, { value: "", label: "" }] })
          }
          className="mt-1 flex items-center gap-1 text-[10px] text-cy-muted hover:text-cy-accent transition-colors"
        >
          <Plus className="h-3 w-3" /> 新增
        </button>
      </div>
    );
  }

  // Dataviz items (label + value) — render as editable rows with value input
  if (
    content.slideType === "dataviz" &&
    field.key === "items" &&
    (content.variant === "horizontal-bars" || content.variant === "comparison")
  ) {
    const items = content.items ?? [];
    return (
      <div>
        <label className="text-xs text-cy-muted block mb-1">{field.label}</label>
        <div className="space-y-1">
          {items.map((item, i) => (
            <div key={i} className="flex gap-1">
              <input
                type="text"
                value={item.label}
                onChange={(e) => {
                  const newItems = [...items];
                  newItems[i] = { ...newItems[i], label: e.target.value };
                  update({ items: newItems });
                }}
                placeholder="標籤"
                className={`flex-1 ${SMALL_INPUT_CLS}`}
              />
              <input
                type="text"
                value={item.value ?? ""}
                onChange={(e) => {
                  const newItems = [...items];
                  newItems[i] = { ...newItems[i], value: e.target.value };
                  update({ items: newItems });
                }}
                placeholder="數值"
                className={`w-16 ${SMALL_INPUT_CLS}`}
              />
            </div>
          ))}
        </div>
        <button
          onClick={() =>
            update({ items: [...items, { label: "", value: "" }] })
          }
          className="mt-1 flex items-center gap-1 text-[10px] text-cy-muted hover:text-cy-accent transition-colors"
        >
          <Plus className="h-3 w-3" /> 新增
        </button>
      </div>
    );
  }

  // Default items — line-separated textarea with " — " delimiter
  const items = content.items ?? [];
  return (
    <div>
      <label className="text-xs text-cy-muted block mb-1">{field.label}</label>
      <textarea
        value={items
          .map((item) => item.label + (item.desc ? ` — ${item.desc}` : ""))
          .join("\n")}
        onChange={(e) => {
          const parsed: ContentItem[] = e.target.value.split("\n").map((line) => {
            const [label, ...descParts] = line.split(" — ");
            return {
              label: label.trim(),
              desc: descParts.join(" — ").trim() || undefined,
            };
          });
          update({ items: parsed });
        }}
        rows={5}
        placeholder={"項目一\n項目二 — 說明\n項目三"}
        className={`${TEXTAREA_CLS} placeholder:text-cy-muted/50`}
      />
    </div>
  );
}

function renderCards(
  field: FieldConfig,
  content: SlideContent,
  update: Updater,
) {
  const cards = content.cards ?? [];
  if (cards.length === 0) return null;

  return (
    <div>
      <label className="text-xs text-cy-muted block mb-1">{field.label}</label>
      <div className="space-y-2">
        {cards.map((card, i) => (
          <div
            key={i}
            className="border border-cy-border/30 rounded-md p-2 space-y-1"
          >
            <div className="flex items-center gap-1">
              {/* Icon picker (emoji input) */}
              <input
                type="text"
                value={card.icon ?? ""}
                onChange={(e) => {
                  const newCards = [...cards];
                  newCards[i] = { ...newCards[i], icon: e.target.value };
                  update({ cards: newCards });
                }}
                placeholder="Icon"
                className={`w-12 ${SMALL_INPUT_CLS} text-center`}
              />
              <input
                type="text"
                value={card.title}
                onChange={(e) => {
                  const newCards = [...cards];
                  newCards[i] = { ...newCards[i], title: e.target.value };
                  update({ cards: newCards });
                }}
                placeholder="標題"
                className={`flex-1 ${SMALL_INPUT_CLS}`}
              />
            </div>
            <textarea
              value={card.body}
              onChange={(e) => {
                const newCards = [...cards];
                newCards[i] = { ...newCards[i], body: e.target.value };
                update({ cards: newCards });
              }}
              rows={2}
              placeholder="內容"
              className={`w-full ${SMALL_INPUT_CLS} resize-none`}
            />
          </div>
        ))}
      </div>
      <button
        onClick={() =>
          update({
            cards: [...cards, { title: "", body: "", icon: "" }],
          })
        }
        className="mt-1 flex items-center gap-1 text-[10px] text-cy-muted hover:text-cy-accent transition-colors"
      >
        <Plus className="h-3 w-3" /> 新增卡片
      </button>
    </div>
  );
}

function renderColumns(
  field: FieldConfig,
  content: SlideContent,
  update: Updater,
) {
  return (
    <div>
      <label className="text-xs text-cy-muted block mb-1">{field.label}</label>
      {([0, 1] as const).map((colIdx) => {
        const col: ContentBlock = content.columns?.[colIdx] ?? {};
        const updateCol = (updates: Partial<ContentBlock>) => {
          const cols: [ContentBlock, ContentBlock] = [
            { ...(content.columns?.[0] ?? {}) },
            { ...(content.columns?.[1] ?? {}) },
          ];
          cols[colIdx] = { ...cols[colIdx], ...updates };
          update({ columns: cols });
        };
        return (
          <div
            key={colIdx}
            className="border border-cy-border/30 rounded-md p-2 space-y-1 mb-2"
          >
            <span className="text-[10px] text-cy-muted uppercase">
              {colIdx === 0 ? "左欄" : "右欄"}
            </span>
            <input
              type="text"
              value={col.title ?? ""}
              onChange={(e) => updateCol({ title: e.target.value })}
              placeholder="欄標題"
              className={`w-full ${SMALL_INPUT_CLS}`}
            />
            <textarea
              value={col.body ?? ""}
              onChange={(e) => updateCol({ body: e.target.value })}
              rows={2}
              placeholder="內文"
              className={`w-full ${SMALL_INPUT_CLS} resize-none`}
            />
            <textarea
              value={(col.items ?? [])
                .map((item) => item.label + (item.desc ? ` — ${item.desc}` : ""))
                .join("\n")}
              onChange={(e) => {
                const items: ContentItem[] = e.target.value.split("\n").map((line) => {
                  const [label, ...descParts] = line.split(" — ");
                  return {
                    label: label.trim(),
                    desc: descParts.join(" — ").trim() || undefined,
                  };
                });
                updateCol({ items });
              }}
              rows={3}
              placeholder={"項目（每行一個）\n項目一 — 說明"}
              className={`w-full ${SMALL_INPUT_CLS} resize-none placeholder:text-cy-muted/50`}
            />
          </div>
        );
      })}
    </div>
  );
}

function renderImages(
  field: FieldConfig,
  content: SlideContent,
  update: Updater,
) {
  const images = content.images ?? [];

  const updateImage = (
    idx: number,
    patch: Partial<{ url: string; caption: string; fit: "cover" | "contain" }>,
  ) => {
    const newImages = [...images];
    newImages[idx] = { ...newImages[idx], ...patch };
    update({ images: newImages });
  };

  const addImage = () => {
    if (images.length >= 4) return;
    update({ images: [...images, { url: "", fit: "cover" }] });
  };

  const removeImage = (idx: number) => {
    update({ images: images.filter((_, i) => i !== idx) });
  };

  return (
    <div>
      <label className="text-xs text-cy-muted block mb-1">{field.label}</label>
      <div className="space-y-2">
        {images.map((img, i) => (
          <div
            key={i}
            className="border border-cy-border/30 rounded-md p-2 space-y-1"
          >
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={img.url}
                onChange={(e) => updateImage(i, { url: e.target.value })}
                placeholder="圖片 URL"
                className={`flex-1 ${SMALL_INPUT_CLS}`}
              />
              <select
                value={img.fit ?? "cover"}
                onChange={(e) =>
                  updateImage(i, {
                    fit: e.target.value as "cover" | "contain",
                  })
                }
                className={`w-20 ${SMALL_INPUT_CLS}`}
              >
                <option value="cover">填滿</option>
                <option value="contain">適配</option>
              </select>
              <button
                onClick={() => removeImage(i)}
                className="text-cy-error hover:text-cy-error/80 transition-colors p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <input
              type="text"
              value={img.caption ?? ""}
              onChange={(e) => updateImage(i, { caption: e.target.value })}
              placeholder="說明文字（選填）"
              className={`w-full ${SMALL_INPUT_CLS} placeholder:text-cy-muted/50`}
            />
          </div>
        ))}
      </div>
      {images.length < 4 && (
        <button
          onClick={addImage}
          className="mt-1 flex items-center gap-1 text-[10px] text-cy-muted hover:text-cy-accent transition-colors"
        >
          <Plus className="h-3 w-3" /> 新增圖片（最多 4 張）
        </button>
      )}
    </div>
  );
}

function renderImage(
  field: FieldConfig,
  content: SlideContent,
  update: Updater,
) {
  const banner = content.bannerImage ?? { url: "", fit: "cover" as const };

  return (
    <div>
      <label className="text-xs text-cy-muted block mb-1">{field.label}</label>
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={banner.url}
          onChange={(e) =>
            update({
              bannerImage: { ...banner, url: e.target.value },
            })
          }
          placeholder="圖片 URL"
          className={`flex-1 ${SMALL_INPUT_CLS} placeholder:text-cy-muted/50`}
        />
        <select
          value={banner.fit ?? "cover"}
          onChange={(e) =>
            update({
              bannerImage: {
                ...banner,
                fit: e.target.value as "cover" | "contain",
              },
            })
          }
          className={`w-20 ${SMALL_INPUT_CLS}`}
        >
          <option value="cover">填滿</option>
          <option value="contain">適配</option>
        </select>
      </div>
    </div>
  );
}

function renderHighlightLines(
  field: FieldConfig,
  content: SlideContent,
  update: Updater,
) {
  const titleText = content.title ?? "";
  const lines = titleText.split("\n").filter(Boolean);
  const highlighted = new Set(content.highlightLines ?? []);

  if (lines.length === 0) {
    return (
      <div>
        <label className="text-xs text-cy-muted block mb-1">{field.label}</label>
        <p className="text-[10px] text-cy-muted/60">先輸入標題文字（用換行分隔行），再勾選要強調的行。</p>
      </div>
    );
  }

  return (
    <div>
      <label className="text-xs text-cy-muted block mb-1">{field.label}</label>
      <div className="space-y-1">
        {lines.map((line, i) => (
          <label
            key={i}
            className="flex items-center gap-2 text-xs text-cy-text cursor-pointer"
          >
            <input
              type="checkbox"
              checked={highlighted.has(i)}
              onChange={(e) => {
                const next = new Set(highlighted);
                if (e.target.checked) {
                  next.add(i);
                } else {
                  next.delete(i);
                }
                update({ highlightLines: Array.from(next).sort() });
              }}
              className="rounded border-cy-border accent-cy-accent"
            />
            <span className={highlighted.has(i) ? "text-cy-accent font-medium" : ""}>
              {line}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
