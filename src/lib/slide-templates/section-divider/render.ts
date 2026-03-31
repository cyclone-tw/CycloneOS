import type { SlideContent } from "@/stores/presentations-store";
import { esc, nl2br, frag, bgStyle, overlayClass } from "../helpers";

export function renderSectionDivider(slide: SlideContent, index: number): string {
  const variant = slide.variant || "dark";
  return `<div class="slide section-divider ${variant}${overlayClass(slide)}" data-index="${index}"${bgStyle(slide)}>
  <div class="slide-inner section-divider-inner">
    ${slide.subtitle ? frag(`<p class="section-label">${nl2br(esc(slide.subtitle))}</p>`) : ""}
    ${slide.title ? frag(`<h2 class="section-title">${nl2br(esc(slide.title))}</h2>`) : ""}
  </div>
</div>`;
}
