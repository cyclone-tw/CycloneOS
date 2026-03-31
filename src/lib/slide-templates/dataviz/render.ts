import type { SlideContent } from "@/stores/presentations-store";
import { esc, nl2br, frag, bgStyle, overlayClass } from "../helpers";

export function renderDataviz(slide: SlideContent, index: number): string {
  const variant = slide.variant || "horizontal-bars";
  let vizHtml = "";

  if (variant === "horizontal-bars" && slide.items) {
    const maxVal = Math.max(
      ...slide.items.map((item) => parseFloat(item.value ?? "0") || 0),
      1
    );
    vizHtml = slide.items
      .map((item, i) => {
        const numVal = parseFloat(item.value ?? "0") || 0;
        const pct = Math.round((numVal / maxVal) * 100);
        const color = item.color ?? `var(--bar-${i % 7})`;
        return frag(`<div class="bar-row">
        <span class="bar-label">${esc(item.label)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>
        <span class="bar-value">${esc(item.value ?? "")}</span>
      </div>`);
      })
      .join("\n    ");
  } else if (variant === "big-number" && slide.bigNumber) {
    vizHtml = frag(`<div class="big-number">
      <span class="big-value">${esc(slide.bigNumber.value)}</span>
      <span class="big-label">${esc(slide.bigNumber.label)}</span>
    </div>`);
    if (slide.body) {
      vizHtml += frag(`<p class="body-text">${nl2br(esc(slide.body))}</p>`);
    }
  } else if (variant === "stats-row" && slide.stats) {
    vizHtml = `<div class="stats-row">${slide.stats
      .map(
        (stat) =>
          frag(`<div class="stat-card">
        <span class="stat-value">${esc(stat.value)}</span>
        <span class="stat-label">${esc(stat.label)}</span>
      </div>`)
      )
      .join("")}</div>`;
  } else if (variant === "comparison" && slide.columns) {
    const cols = slide.columns;
    vizHtml = `<div class="comparison-grid">
      ${frag(`<div class="compare-col compare-left">
        <h3>${esc(cols[0].title ?? "")}</h3>
        <ul>${(cols[0].items ?? []).map((item) => `<li>${esc(item.label)}${item.value ? `: ${esc(item.value)}` : ""}</li>`).join("")}</ul>
      </div>`)}
      ${frag(`<div class="compare-col compare-right">
        <h3>${esc(cols[1].title ?? "")}</h3>
        <ul>${(cols[1].items ?? []).map((item) => `<li>${esc(item.label)}${item.value ? `: ${esc(item.value)}` : ""}</li>`).join("")}</ul>
      </div>`)}
    </div>`;
  }

  return `<div class="slide dataviz ${variant}${overlayClass(slide)}" data-index="${index}"${bgStyle(slide)}>
  <div class="slide-inner dataviz-inner">
    ${slide.title ? frag(`<h2>${nl2br(esc(slide.title))}</h2>`) : ""}
    ${vizHtml}
    ${slide.footnote ? frag(`<p class="footnote">${nl2br(esc(slide.footnote))}</p>`) : ""}
  </div>
</div>`;
}
