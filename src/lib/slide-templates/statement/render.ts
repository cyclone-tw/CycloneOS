import type { SlideContent } from "@/stores/presentations-store";
import { esc, nl2br, frag, bgStyle, overlayClass } from "../helpers";

export function renderStatement(slide: SlideContent, index: number): string {
  const variant = slide.variant || "centered";
  const highlightSet = new Set(slide.highlightLines ?? []);
  const lines = (slide.title ?? "").split("\n");

  const linesHtml = lines
    .map((line, i) => {
      const escaped = esc(line);
      if (!highlightSet.has(i)) {
        return `<span class="statement-line">${escaped}</span>`;
      }
      if (variant === "highlight") {
        return `<span class="statement-line statement-highlight">${escaped}</span>`;
      }
      return `<span class="statement-line statement-accent">${escaped}</span>`;
    })
    .join("<br>");

  const barHtml = variant === "left-bold" ? `<div class="statement-bar"></div>` : "";

  return `<div class="slide statement statement-${variant}${overlayClass(slide)}" data-index="${index}"${bgStyle(slide)}>
  <div class="slide-inner statement-inner">
    ${barHtml}
    ${frag(`<div class="statement-text">${linesHtml}</div>`)}
    ${slide.body ? frag(`<p class="statement-body">${nl2br(esc(slide.body))}</p>`) : ""}
  </div>
</div>`;
}
