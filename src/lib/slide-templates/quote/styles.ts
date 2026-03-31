// Quote template CSS.
// Dynamic theme-dependent rules (font sizes, card bg) remain in slide-engine-css.ts.

export function quoteStyles(): string {
  return `
/* === Quote (plugin static) === */
.quote-inner { justify-content: center; align-items: center; text-align: center; padding: 64px 80px; }
blockquote { max-width: 900px; }
.quote-text { font-style: italic; line-height: 1.5; font-family: var(--font-heading); }
.quote-author { display: block; margin-top: 20px; font-size: var(--small-size); color: var(--slide-muted); font-style: normal; }
.quote.fullscreen .slide-inner { padding: 64px; }
.quote.card-overlay blockquote { background: var(--slide-card-bg); border-radius: var(--slide-card-radius); padding: 40px; border-left: 4px solid var(--slide-accent); text-align: left; }
`;
}
