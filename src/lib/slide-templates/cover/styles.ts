// Cover template CSS.
// Note: Most cover styles are theme-dependent (dynamic values from buildCSS).
// This returns only the static structural rules that don't depend on theme variables.
// The dynamic rules (font sizes, gradient bg) remain in slide-engine-css.ts.

export function coverStyles(): string {
  return `
/* === Cover (plugin static) === */
.cover .slide-inner { justify-content: center; align-items: center; text-align: center; padding: 64px; }
`;
}
