import type { SlideContent } from "@/stores/presentations-store";
import { esc, nl2br, frag, bgStyle, overlayClass } from "../helpers";

export function renderTwoColumn(slide: SlideContent, index: number): string {
  const variant = slide.variant || "text-text";

  function renderColumn(
    col: { title?: string; items?: { label: string; value?: string; desc?: string }[]; body?: string },
    className: string
  ): string {
    let inner = "";
    if (col.title) inner += `<h3 class="col-title">${nl2br(esc(col.title))}</h3>`;
    if (col.items) {
      inner += `<ul class="col-list">${col.items
        .map(
          (item) =>
            `<li><strong>${esc(item.label)}</strong>${item.value ? `: ${esc(item.value)}` : ""}${item.desc ? `<span class="item-desc"> — ${nl2br(esc(item.desc))}</span>` : ""}</li>`
        )
        .join("")}</ul>`;
    }
    if (col.body) inner += `<p class="col-body">${nl2br(esc(col.body))}</p>`;
    return frag(`<div class="${className}">${inner}</div>`);
  }

  const cols = slide.columns ?? [{ body: "" }, { body: "" }];

  return `<div class="slide two-column ${variant}${overlayClass(slide)}" data-index="${index}"${bgStyle(slide)}>
  <div class="slide-inner two-column-inner">
    ${slide.title ? frag(`<h2>${nl2br(esc(slide.title))}</h2>`) : ""}
    <div class="columns">
      ${renderColumn(cols[0], "col col-left")}
      ${renderColumn(cols[1], "col col-right")}
    </div>
    ${slide.footnote ? frag(`<p class="footnote">${nl2br(esc(slide.footnote))}</p>`) : ""}
  </div>
</div>`;
}
