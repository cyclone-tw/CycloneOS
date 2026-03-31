import type { SlideContent } from "@/stores/presentations-store";
import { esc, nl2br, frag, bgStyle, overlayClass } from "../helpers";

export function renderTitleCards(slide: SlideContent, index: number): string {
  const variant = slide.variant || "banner-3";
  const cards = slide.cards ?? [];
  const banner = slide.bannerImage;

  const bannerHtml = banner?.url
    ? `<div class="tc-banner">${frag(
        `<img src="${esc(banner.url)}" alt="" style="object-fit:${banner.fit ?? "cover"}" />`
      )}</div>`
    : "";

  const gridClass = variant === "banner-2" ? "tc-grid-2" : variant === "banner-4" ? "tc-grid-4" : "tc-grid-3";

  const cardsHtml = cards
    .map(
      (card) =>
        frag(`<div class="tc-card">
      ${card.imageUrl ? `<div class="tc-card-img"><img src="${esc(card.imageUrl)}" alt="" /></div>` : ""}
      <div class="tc-card-body">
        <h3>${nl2br(esc(card.title))}</h3>
        ${card.body ? `<p>${nl2br(esc(card.body))}</p>` : ""}
      </div>
    </div>`)
    )
    .join("\n    ");

  return `<div class="slide title-cards ${variant}${overlayClass(slide)}" data-index="${index}"${bgStyle(slide)}>
  <div class="slide-inner title-cards-inner">
    ${slide.title ? frag(`<h2>${nl2br(esc(slide.title))}</h2>`) : ""}
    ${bannerHtml}
    <div class="tc-grid ${gridClass}">${cardsHtml}</div>
  </div>
</div>`;
}
