// Closing template CSS.
// Dynamic theme-dependent rules (font sizes) remain in slide-engine-css.ts.

export function closingStyles(): string {
  return `
/* === Closing (plugin static) === */
.closing .slide-inner { justify-content: center; align-items: center; padding: 64px; position: relative; }
.closing h1 { text-align: center; }
.cta-text { color: var(--slide-muted); max-width: 600px; text-align: left; }
.closing .footnote { text-align: center; }
`;
}
