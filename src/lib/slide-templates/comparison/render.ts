import type { SlideContent } from "@/stores/presentations-store";
import { esc, nl2br, frag, bgStyle, overlayClass } from "../helpers";

export function renderComparison(slide: SlideContent, index: number): string {
  const variant = slide.variant || "vs-split";
  const cols = slide.columns ?? [{ body: "" }, { body: "" }];

  function renderItems(items?: { label: string; value?: string; desc?: string }[]): string {
    if (!items || items.length === 0) return "";
    return `<ul class="comparison-items">${items
      .map(
        (item) =>
          `<li>${esc(item.label)}${item.value ? `: ${esc(item.value)}` : ""}${item.desc ? `<span class="item-desc"> — ${nl2br(esc(item.desc))}</span>` : ""}</li>`
      )
      .join("")}</ul>`;
  }

  function renderCol(col: typeof cols[0], side: "left" | "right"): string {
    let inner = "";
    if (col.title) inner += `<h3 class="comparison-col-title">${nl2br(esc(col.title))}</h3>`;
    if (col.items) inner += renderItems(col.items);
    if (col.body) inner += `<p class="comparison-col-body">${nl2br(esc(col.body))}</p>`;
    return inner ? `<div class="comparison-col comparison-${side}">${inner}</div>` : `<div class="comparison-col comparison-${side}"></div>`;
  }

  let columnsHtml = "";

  if (variant === "vs-split") {
    columnsHtml = `<div class="comparison-columns comparison-vs-split">
      ${frag(renderCol(cols[0], "left"))}
      <div class="comparison-vs">VS</div>
      ${frag(renderCol(cols[1], "right"))}
    </div>`;
  } else if (variant === "before-after") {
    columnsHtml = `<div class="comparison-columns comparison-before-after">
      ${frag(`<div class="comparison-col comparison-left">
        <span class="comparison-label comparison-label-before">BEFORE</span>
        ${cols[0].title ? `<h3 class="comparison-col-title">${nl2br(esc(cols[0].title))}</h3>` : ""}
        ${renderItems(cols[0].items)}
        ${cols[0].body ? `<p class="comparison-col-body">${nl2br(esc(cols[0].body))}</p>` : ""}
      </div>`)}
      <div class="comparison-arrow">&#10132;</div>
      ${frag(`<div class="comparison-col comparison-right">
        <span class="comparison-label comparison-label-after">AFTER</span>
        ${cols[1].title ? `<h3 class="comparison-col-title">${nl2br(esc(cols[1].title))}</h3>` : ""}
        ${renderItems(cols[1].items)}
        ${cols[1].body ? `<p class="comparison-col-body">${nl2br(esc(cols[1].body))}</p>` : ""}
      </div>`)}
    </div>`;
  } else {
    // pros-cons
    columnsHtml = `<div class="comparison-columns comparison-pros-cons">
      ${frag(`<div class="comparison-col comparison-left">
        <span class="comparison-label comparison-label-cons">\u{1F44E} ${cols[0].title ? nl2br(esc(cols[0].title)) : "Cons"}</span>
        ${renderItems(cols[0].items)}
        ${cols[0].body ? `<p class="comparison-col-body">${nl2br(esc(cols[0].body))}</p>` : ""}
      </div>`)}
      ${frag(`<div class="comparison-col comparison-right">
        <span class="comparison-label comparison-label-pros">\u{1F44D} ${cols[1].title ? nl2br(esc(cols[1].title)) : "Pros"}</span>
        ${renderItems(cols[1].items)}
        ${cols[1].body ? `<p class="comparison-col-body">${nl2br(esc(cols[1].body))}</p>` : ""}
      </div>`)}
    </div>`;
  }

  return `<div class="slide comparison ${variant}${overlayClass(slide)}" data-index="${index}"${bgStyle(slide)}>
  <div class="slide-inner comparison-inner">
    ${slide.title ? frag(`<h2>${nl2br(esc(slide.title))}</h2>`) : ""}
    ${columnsHtml}
    ${slide.footnote ? frag(`<p class="footnote">${nl2br(esc(slide.footnote))}</p>`) : ""}
  </div>
</div>`;
}
