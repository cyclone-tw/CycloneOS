// Title Cards template CSS.

export function titleCardsStyles(): string {
  return `
/* === Title Cards (plugin static) === */
.title-cards-inner { justify-content: flex-start; gap: var(--gap-size); }
.tc-banner {
  width: 100%;
  max-height: 35%;
  border-radius: var(--slide-border-radius);
  overflow: hidden;
  flex-shrink: 0;
}
.tc-banner img { width: 100%; height: 100%; display: block; object-fit: cover; }
.tc-grid { display: grid; gap: var(--gap-size); flex: 1; width: 100%; }
.tc-grid-2 { grid-template-columns: repeat(2, 1fr); }
.tc-grid-3 { grid-template-columns: repeat(3, 1fr); }
.tc-grid-4 { grid-template-columns: repeat(4, 1fr); }
.tc-card {
  background: var(--slide-card-bg);
  border-radius: var(--slide-border-radius);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: var(--slide-shadow);
}
.tc-card-img { flex-shrink: 0; }
.tc-card-img img { width: 100%; display: block; object-fit: cover; aspect-ratio: 16/9; }
.tc-card-body { padding: 16px; }
.tc-card-body h3 { font-size: var(--body-size); margin-bottom: 6px; }
.tc-card-body p { font-size: var(--small-size); color: var(--slide-muted); line-height: 1.5; }
`;
}
