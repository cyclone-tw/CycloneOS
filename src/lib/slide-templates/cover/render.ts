import type { SlideContent } from "@/stores/presentations-store";
import { esc, nl2br, frag, bgStyle, overlayClass, badgeHtml } from "../helpers";

export function renderCover(slide: SlideContent, index: number): string {
  const variant = slide.variant || "gradient";
  return `<div class="slide cover ${variant}${overlayClass(slide)}" data-index="${index}"${bgStyle(slide)}>
  <div class="slide-inner cover-inner">
    ${badgeHtml(slide)}
    ${slide.title ? frag(`<h1>${nl2br(esc(slide.title))}</h1>`) : ""}
    ${slide.subtitle ? frag(`<p class="subtitle">${nl2br(esc(slide.subtitle))}</p>`) : ""}
    ${slide.footnote ? frag(`<p class="footnote">${nl2br(esc(slide.footnote))}</p>`) : ""}
  </div>
</div>`;
}
