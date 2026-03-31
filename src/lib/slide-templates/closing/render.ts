import type { SlideContent } from "@/stores/presentations-store";
import { esc, nl2br, frag, bgStyle, overlayClass } from "../helpers";

export function renderClosing(slide: SlideContent, index: number): string {
  const variant = slide.variant || "thank-you";

  return `<div class="slide closing ${variant}${overlayClass(slide)}" data-index="${index}"${bgStyle(slide)}>
  <div class="slide-inner closing-inner">
    ${slide.title ? frag(`<h1>${nl2br(esc(slide.title))}</h1>`) : ""}
    ${slide.body ? frag(`<p class="cta-text">${nl2br(esc(slide.body))}</p>`) : ""}
    ${slide.footnote ? frag(`<p class="footnote">${nl2br(esc(slide.footnote))}</p>`) : ""}
  </div>
</div>`;
}
