import type { SlideContent } from "@/stores/presentations-store";
import { esc, nl2br, frag, bgStyle, overlayClass } from "../helpers";

export function renderContent(slide: SlideContent, index: number): string {
  const variant = slide.variant || "bullets";
  let bodyHtml = "";

  if (variant === "bullets" && slide.items) {
    bodyHtml = slide.items
      .map(
        (item) =>
          `<li class="fragment"><strong>${esc(item.label)}</strong>${item.desc ? `<span class="item-desc"> — ${nl2br(esc(item.desc))}</span>` : ""}</li>`
      )
      .join("\n      ");
    bodyHtml = `<ul class="content-list">\n      ${bodyHtml}\n    </ul>`;
  } else if (variant === "numbered" && slide.items) {
    bodyHtml = slide.items
      .map(
        (item, i) =>
          `<li class="fragment"><span class="num">${i + 1}</span><strong>${esc(item.label)}</strong>${item.desc ? `<span class="item-desc"> — ${nl2br(esc(item.desc))}</span>` : ""}</li>`
      )
      .join("\n      ");
    bodyHtml = `<ol class="content-list numbered">\n      ${bodyHtml}\n    </ol>`;
  } else if (slide.body) {
    bodyHtml = frag(`<p class="body-text">${nl2br(esc(slide.body))}</p>`);
  }

  return `<div class="slide content ${variant}${overlayClass(slide)}" data-index="${index}"${bgStyle(slide)}>
  <div class="slide-inner content-inner">
    ${slide.title ? frag(`<h2>${nl2br(esc(slide.title))}</h2>`) : ""}
    ${bodyHtml}
    ${slide.footnote ? frag(`<p class="footnote">${nl2br(esc(slide.footnote))}</p>`) : ""}
  </div>
</div>`;
}
