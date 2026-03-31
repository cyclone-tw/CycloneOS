// Icon Grid template CSS.

export function iconGridStyles(): string {
  return `
/* === Icon Grid (plugin static) === */
.icon-grid-inner { justify-content: center; align-items: center; }
.ig-grid { display: grid; gap: var(--gap-size); flex: 1; width: 100%; align-items: start; }
.ig-grid.grid-3 { grid-template-columns: repeat(3, 1fr); }
.ig-grid.grid-4 { grid-template-columns: repeat(2, 1fr); }
.ig-grid.grid-6 { grid-template-columns: repeat(3, 1fr); }
.icon-card {
  background: var(--slide-card-bg);
  border-radius: var(--slide-border-radius);
  padding: 28px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: var(--slide-shadow);
}
.ig-icon { font-size: 2.4em; margin-bottom: 12px; display: block; text-align: center; }
.ig-title { margin-bottom: 6px; font-size: var(--body-size); text-align: center; }
.ig-body { font-size: var(--small-size); color: var(--slide-muted); line-height: 1.5; text-align: left; align-self: stretch; }
`;
}
