// Comparison template CSS.

export function comparisonStyles(): string {
  return `
/* === Comparison (plugin static) === */
.comparison-inner { justify-content: center; }
.comparison-columns { display: grid; gap: var(--gap-size); flex: 1; align-items: stretch; }

/* VS Split: 3-column grid with center divider */
.comparison-vs-split { grid-template-columns: 1fr auto 1fr; }
.comparison-vs-split .comparison-left {
  background: rgba(180,60,60,0.08);
  border: 1px solid rgba(180,60,60,0.25);
  border-radius: var(--slide-border-radius);
  padding: 24px;
}
.comparison-vs-split .comparison-right {
  background: rgba(60,180,60,0.08);
  border: 1px solid rgba(60,180,60,0.25);
  border-radius: var(--slide-border-radius);
  padding: 24px;
}
.comparison-vs {
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 1.4em;
  color: var(--slide-accent);
  background: var(--slide-card-bg);
  border-radius: 50%;
  width: 48px;
  height: 48px;
  align-self: center;
  flex-shrink: 0;
}

/* Before-After: 2-column with arrow */
.comparison-before-after { grid-template-columns: 1fr auto 1fr; }
.comparison-before-after .comparison-col {
  border: 1px solid var(--slide-secondary);
  border-radius: var(--slide-border-radius);
  padding: 24px;
}
.comparison-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.8em;
  color: var(--slide-accent);
  align-self: center;
}

/* Pros-Cons: card style with accent borders */
.comparison-pros-cons { grid-template-columns: 1fr 1fr; }
.comparison-pros-cons .comparison-col {
  background: var(--slide-card-bg);
  border-radius: var(--slide-border-radius);
  padding: 24px;
  box-shadow: var(--slide-shadow);
}
.comparison-pros-cons .comparison-left { border-left: 4px solid rgba(180,60,60,0.7); }
.comparison-pros-cons .comparison-right { border-left: 4px solid rgba(60,180,60,0.7); }

/* Shared column styles */
.comparison-col-title { margin-bottom: 12px; font-size: var(--body-size); }
.comparison-col-body { font-size: var(--body-size); color: var(--slide-muted); line-height: 1.6; }
.comparison-items { list-style: none; padding: 0; }
.comparison-items li {
  padding: 8px 0;
  font-size: var(--body-size);
  line-height: 1.5;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.comparison-items li:last-child { border-bottom: none; }

/* Labels */
.comparison-label {
  display: inline-block;
  font-weight: 700;
  font-size: var(--small-size);
  padding: 4px 12px;
  border-radius: 4px;
  margin-bottom: 12px;
}
.comparison-label-before { background: rgba(255,255,255,0.1); }
.comparison-label-after { background: var(--slide-accent); color: #fff; }
.comparison-label-cons { color: rgba(180,60,60,0.9); }
.comparison-label-pros { color: rgba(60,180,60,0.9); }
`;
}
