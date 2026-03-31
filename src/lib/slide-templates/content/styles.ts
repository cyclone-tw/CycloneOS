// Content template CSS.
// Dynamic theme-dependent rules (card bg, font sizes) remain in slide-engine-css.ts.

export function contentStyles(): string {
  return `
/* === Content (plugin static) === */
.content .slide-inner { justify-content: center; }
.content-list { list-style: none; padding: 0; flex: 1; display: flex; flex-direction: column; justify-content: center; }
.content-list li {
  padding: 14px 20px;
  margin-bottom: 8px;
  border-left: 3px solid var(--slide-accent);
  background: var(--slide-card-bg);
  border-radius: var(--slide-card-radius);
  font-size: var(--body-size);
  line-height: 1.5;
  box-shadow: var(--slide-shadow);
}
.content-list.numbered li { display: flex; align-items: baseline; gap: 16px; }
`;
}
