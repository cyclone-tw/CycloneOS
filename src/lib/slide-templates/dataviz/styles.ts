// Dataviz template CSS.
// Dynamic theme-dependent rules (font sizes, track bg, card bg) remain in slide-engine-css.ts.

export function datavizStyles(): string {
  return `
/* === Dataviz (plugin static) === */
.dataviz-inner { justify-content: center; }
.bar-row { display: flex; align-items: center; gap: var(--gap-size); margin-bottom: 10px; }
.bar-label { font-size: var(--body-size); min-width: 140px; text-align: right; }
.bar-track { flex: 1; height: 44px; border-radius: var(--slide-card-radius); overflow: hidden; }
.bar-fill { height: 100%; border-radius: var(--slide-card-radius); transition: width 0.8s ease; }
.bar-value { font-size: var(--small-size); font-weight: 700; min-width: 70px; font-family: var(--font-mono); color: var(--slide-accent); }

/* big-number */
.dataviz-inner > .big-number { text-align: center; padding: var(--card-padding) 0; }
.big-value { font-weight: 800; font-family: var(--font-heading); color: var(--slide-accent); display: block; line-height: 1; }
.big-label { font-size: var(--subtitle-size); color: var(--slide-muted); display: block; margin-top: 12px; }

/* stats-row */
.dataviz-inner > .stats-row { display: flex; gap: var(--gap-size); justify-content: center; flex-wrap: wrap; }
.stat-card { text-align: center; flex: 1; min-width: 140px; }
.stat-value { font-weight: 800; font-family: var(--font-heading); color: var(--slide-accent); display: block; line-height: 1; }
.stat-label { font-size: var(--small-size); color: var(--slide-muted); display: block; margin-top: 10px; }

/* comparison-grid */
.dataviz-inner > .comparison-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--gap-size); }
.compare-col { background: var(--slide-card-bg); }
.compare-col h3 { margin-bottom: 12px; }
.compare-col ul { list-style: none; padding: 0; }
.compare-col li { padding: 6px 0; font-size: var(--body-size); }
.compare-left { border-left: 4px solid var(--slide-accent); }
.compare-right { border-left: 4px solid var(--slide-secondary); }
`;
}
