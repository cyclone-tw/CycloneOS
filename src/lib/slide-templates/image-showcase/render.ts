import type { SlideContent } from "@/stores/presentations-store";
import { esc, nl2br, frag, bgStyle, overlayClass } from "../helpers";

export function renderImageShowcase(slide: SlideContent, index: number): string {
  const variant = slide.variant || "single";
  const images = slide.images ?? [];

  const imagesHtml = images
    .map((img) => {
      const fit = img.fit ?? "cover";
      return `<div class="is-img-container">
      <img src="${esc(img.url)}" alt="" style="object-fit:${fit}" />
      ${img.caption ? `<div class="is-caption">${esc(img.caption)}</div>` : ""}
    </div>`;
    })
    .join("\n    ");

  return `<div class="slide image-showcase ${variant}${overlayClass(slide)}" data-index="${index}"${bgStyle(slide)}>
  <div class="slide-inner image-showcase-inner">
    ${slide.title ? frag(`<h2>${nl2br(esc(slide.title))}</h2>`) : ""}
    ${slide.subtitle ? frag(`<p class="subtitle">${nl2br(esc(slide.subtitle))}</p>`) : ""}
    <div class="is-grid is-${variant}">${imagesHtml}</div>
    ${slide.footnote ? frag(`<p class="footnote">${nl2br(esc(slide.footnote))}</p>`) : ""}
  </div>
</div>`;
}
