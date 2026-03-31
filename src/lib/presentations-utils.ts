// dashboard/src/lib/presentations-utils.ts

import type { SlideOutline, SlideSettings, SlideDefinition, CustomParams } from "@/stores/presentations-store";
import { DEFAULT_CUSTOM_PARAMS } from "@/stores/presentations-store";
import { getThemeById, type PresentationTheme } from "./presentation-themes";
import { slideToHtml } from "./slide-templates";
import { buildCSS, buildSlideOverrideCSS } from "./slide-engine-css";
import { buildNavJS } from "./slide-engine-nav";
import { getSlideAnimation } from "./slide-animation-defaults";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Convert SlideOutline to a self-contained HTML document.
 * No external dependencies except Google Fonts.
 */
export function outlineToHtml(
  outline: SlideOutline,
  theme?: PresentationTheme,
  settings?: SlideSettings
): string {
  const resolvedTheme = theme ?? (outline.theme ? getThemeById(outline.theme) : undefined) ?? getDefaultTheme();
  const cardClass = settings?.cardStyle ?? resolvedTheme.personality.cardEffect;
  const darkLightClass = resolvedTheme.isDark ? "dark" : "light";

  const animLevel = settings?.animationLevel ?? "moderate";
  const sorted = outline.slides.sort((a, b) => a.order - b.order);
  const slidesHtml = sorted
    .map((slide, i) => {
      const anim = animLevel !== "none" ? getSlideAnimation(slide) : undefined;
      return slideToHtml(slide.content, i, sorted.length, anim);
    })
    .join("\n");

  const fontsLink = resolvedTheme.googleFontsUrl
    ? `<link rel="stylesheet" href="${resolvedTheme.googleFontsUrl}">`
    : "";

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(outline.title)}</title>
  ${fontsLink}
  <style>${buildCSS(resolvedTheme, settings)}
${sorted.map((slide, i) => slide.customParams ? buildSlideOverrideCSS(i, slide.customParams, settings?.customParams) : "").filter(Boolean).join("\n")}</style>
</head>
<body>
  <div class="viewport">
    <div class="slide-deck card-${cardClass} ${darkLightClass}">
${slidesHtml}
    </div>
  </div>

  <!-- Navigation UI -->
  <div class="nav-title">${escapeHtml(outline.title)}</div>
  <div class="nav-bar">
    <button id="nav-prev" aria-label="Previous">&#8592;</button>
    <button id="nav-next" aria-label="Next">&#8594;</button>
    <span id="page-counter">1 / ${sorted.length}</span>
    <span id="fragment-progress" style="display:none;margin-left:12px;font-size:13px;letter-spacing:2px"></span>
    <div style="flex:1"></div>
    <button id="present-btn" style="font-size:13px;padding:4px 12px;cursor:pointer;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.2);border-radius:4px;color:inherit">&#9654; 演示</button>
    <button id="exit-btn" style="display:none;font-size:13px;padding:4px 12px;cursor:pointer;background:rgba(255,0,0,0.2);border:1px solid rgba(255,255,255,0.2);border-radius:4px;color:inherit">&#10005; 退出</button>
  </div>
  <div id="progress-bar" class="progress-bar"></div>

  <script>${buildNavJS()}<\/script>
</body>
</html>`;
}

/**
 * Convert SlideOutline to a speaker notes Markdown document.
 */
export function outlineToSpeakerNotes(outline: SlideOutline): string {
  const sorted = [...outline.slides].sort((a, b) => a.order - b.order);
  const lines: string[] = [
    `# ${outline.title} — 講稿`,
    "",
    `> 共 ${sorted.length} 頁投影片`,
    "",
    "---",
    "",
  ];

  for (const slide of sorted) {
    const num = slide.order + 1;
    const title = slide.content.title || slide.content.subtitle || `Slide ${num}`;
    const typeLabel = slide.content.slideType;

    lines.push(`## 第 ${num} 頁：${title}`);
    lines.push("");
    lines.push(`> 類型：${typeLabel} / ${slide.content.variant}`);
    lines.push("");

    if (slide.speakerNotes) {
      lines.push(slide.speakerNotes);
    } else {
      lines.push("_（無講稿）_");
    }

    lines.push("");
    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}

function getDefaultTheme(): PresentationTheme {
  return getThemeById("mckinsey")!;
}
