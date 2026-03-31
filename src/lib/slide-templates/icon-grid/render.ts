import type { SlideContent } from "@/stores/presentations-store";
import { esc, nl2br, frag, bgStyle, overlayClass } from "../helpers";

export function renderIconGrid(slide: SlideContent, index: number): string {
  const variant = slide.variant || "grid-3";
  const cards = slide.cards ?? [];

  const cardsHtml = cards
    .map(
      (card) =>
        frag(`<div class="icon-card">
      ${card.icon ? `<span class="ig-icon">${esc(card.icon)}</span>` : ""}
      <h3 class="ig-title">${nl2br(esc(card.title))}</h3>
      ${card.body ? `<p class="ig-body">${nl2br(esc(card.body))}</p>` : ""}
    </div>`)
    )
    .join("\n    ");

  return `<div class="slide icon-grid ${variant}${overlayClass(slide)}" data-index="${index}"${bgStyle(slide)}>
  <div class="slide-inner icon-grid-inner">
    ${slide.title ? frag(`<h2>${nl2br(esc(slide.title))}</h2>`) : ""}
    <div class="ig-grid ${variant}">${cardsHtml}</div>
    ${slide.footnote ? frag(`<p class="footnote">${nl2br(esc(slide.footnote))}</p>`) : ""}
  </div>
</div>`;
}
