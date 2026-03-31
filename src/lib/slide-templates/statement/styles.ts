// Statement template CSS.

export function statementStyles(): string {
  return `
/* === Statement (plugin static) === */
.statement-inner {
  justify-content: center;
  align-items: center;
  padding: 60px 80px;
}
.statement-text {
  font-size: 44px;
  font-weight: 800;
  line-height: 1.6;
}
.statement-centered .statement-inner { text-align: center; }
.statement-left-bold .statement-inner { text-align: left; align-items: flex-start; }
.statement-highlight .statement-inner { text-align: center; }
.statement-bar {
  width: 40px;
  height: 4px;
  background: var(--slide-accent);
  margin-bottom: 24px;
  border-radius: 2px;
}
.statement-accent { color: var(--slide-accent); }
.statement-highlight {
  background: var(--slide-accent);
  color: #fff;
  padding: 2px 12px;
  border-radius: 4px;
}
.statement-body {
  font-size: var(--body-size);
  color: var(--slide-muted);
  margin-top: 28px;
}
`;
}
