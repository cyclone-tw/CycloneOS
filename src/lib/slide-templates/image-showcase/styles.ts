// Image Showcase template CSS.

export function imageShowcaseStyles(): string {
  return `
/* === Image Showcase (plugin static) === */
.image-showcase-inner { justify-content: center; align-items: center; }
.is-grid { display: grid; gap: var(--gap-size); flex: 1; width: 100%; }
.is-single { grid-template-columns: 1fr; }
.is-duo { grid-template-columns: 1fr 1fr; }
.is-trio { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
.is-trio .is-img-container:first-child { grid-row: span 2; }
.is-quad { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
.is-img-container {
  position: relative;
  border-radius: var(--slide-border-radius);
  overflow: hidden;
  background: var(--slide-card-bg);
}
.is-img-container img {
  width: 100%;
  height: 100%;
  display: block;
}
.is-caption {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 8px 14px;
  background: rgba(0,0,0,0.6);
  color: #fff;
  font-size: var(--small-size);
  line-height: 1.4;
}
`;
}
