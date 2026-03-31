// Two Column template CSS.
// Dynamic theme-dependent rules (font sizes, border colors) remain in slide-engine-css.ts.

export function twoColumnStyles(): string {
  return `
/* === Two Column (plugin static) === */
.two-column-inner { justify-content: center; }
.two-column-inner > .columns { display: grid; grid-template-columns: 1fr 1fr; gap: var(--gap-size); flex: 1; align-items: start; }
.col-list { list-style: none; padding: 0; }
.col-list li { padding: 8px 0; font-size: var(--body-size); }
.col-body { font-size: var(--body-size); line-height: 1.7; }
`;
}
