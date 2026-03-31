import type { SlideContent } from "@/stores/presentations-store";
import { esc, nl2br, frag, bgStyle, overlayClass } from "../helpers";

export function renderQuote(slide: SlideContent, index: number): string {
  const variant = slide.variant || "simple";
  const q = slide.quote ?? { text: "" };

  return `<div class="slide quote ${variant}${overlayClass(slide)}" data-index="${index}"${bgStyle(slide)}>
  <div class="slide-inner quote-inner">
    ${frag(`<blockquote>
      <p class="quote-text">${nl2br(esc(q.text))}</p>
      ${q.author ? `<cite class="quote-author">— ${esc(q.author)}${q.source ? `, ${esc(q.source)}` : ""}</cite>` : ""}
    </blockquote>`)}
    ${slide.body ? frag(`<p class="body-text">${nl2br(esc(slide.body))}</p>`) : ""}
  </div>
</div>`;
}
