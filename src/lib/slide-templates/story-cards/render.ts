import type { SlideContent } from "@/stores/presentations-store";
import { esc, nl2br, frag, bgStyle, overlayClass } from "../helpers";

export function renderStoryCards(slide: SlideContent, index: number): string {
  const variant = slide.variant || "grid-3";
  const cards = slide.cards ?? [];

  const cardsHtml = cards
    .map(
      (card) =>
        frag(`<div class="story-card">
      ${card.icon ? `<span class="card-icon">${esc(card.icon)}</span>` : ""}
      <h3 class="card-title">${nl2br(esc(card.title))}</h3>
      <p class="card-body">${nl2br(esc(card.body))}</p>
    </div>`)
    )
    .join("\n    ");

  return `<div class="slide story-cards ${variant}${overlayClass(slide)}" data-index="${index}"${bgStyle(slide)}>
  <div class="slide-inner story-cards-inner">
    ${slide.title ? frag(`<h2>${nl2br(esc(slide.title))}</h2>`) : ""}
    <div class="cards-grid ${variant}">${cardsHtml}</div>
    ${slide.footnote ? frag(`<p class="footnote">${nl2br(esc(slide.footnote))}</p>`) : ""}
  </div>
</div>`;
}
