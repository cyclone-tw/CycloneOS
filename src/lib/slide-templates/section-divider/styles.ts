// Section Divider template CSS.
// Dynamic theme-dependent rules (colors, font sizes) remain in slide-engine-css.ts.

export function sectionDividerStyles(): string {
  return `
/* === Section Divider (plugin static) === */
.section-divider .slide-inner { justify-content: center; align-items: flex-start; padding: 64px 80px; position: relative; }
.section-divider .section-label { font-size: 14px; letter-spacing: 3px; text-transform: uppercase; color: var(--slide-muted); margin-bottom: 12px; }
.section-divider .section-title { max-width: 100%; word-break: keep-all; }
`;
}
