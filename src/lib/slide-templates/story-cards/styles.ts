// Story Cards template CSS.
// Dynamic theme-dependent rules (font sizes, card bg) remain in slide-engine-css.ts.

export function storyCardsStyles(): string {
  return `
/* === Story Cards (plugin static) === */
.story-cards-inner { justify-content: center; }
.story-cards-inner > .cards-grid { display: grid; gap: var(--gap-size); flex: 1; align-items: start; }
.story-cards-inner > .cards-grid.grid-3 { grid-template-columns: repeat(3, 1fr); }
.story-cards-inner > .cards-grid.grid-2 { grid-template-columns: repeat(2, 1fr); }
.story-cards-inner > .cards-grid.single { grid-template-columns: 1fr; max-width: 600px; }
.story-card { background: var(--slide-card-bg); text-align: left; }
.card-title { margin-bottom: 6px; }
.card-body { font-size: var(--body-size); color: var(--slide-muted); line-height: 1.5; text-align: left; }
`;
}
