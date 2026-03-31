// dashboard/src/lib/slide-engine-css.ts

import type { PresentationTheme, ThemePersonality } from "./presentation-themes";
import { DEFAULT_CUSTOM_PARAMS } from "@/stores/presentations-store";
import type { CustomParams, SlideSettings, AnimationLevel } from "@/stores/presentations-store";
import { buildAllTemplateCSS } from "./slide-templates";

/* === Helper functions === */

function shadowValue(depth: ThemePersonality["shadowDepth"], isDark: boolean): string {
  const alpha = isDark ? 0.4 : 0.1;
  switch (depth) {
    case "none": return "none";
    case "subtle": return `0 1px 3px rgba(0,0,0,${alpha})`;
    case "medium": return `0 4px 12px rgba(0,0,0,${alpha * 1.5})`;
    case "heavy": return `0 8px 24px rgba(0,0,0,${alpha * 2})`;
  }
}

function borderValue(style: ThemePersonality["borderStyle"], accent: string, isDark: boolean): string {
  const base = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
  switch (style) {
    case "none": return "none";
    case "thin": return `1px solid ${base}`;
    case "thick": return `2px solid ${base}`;
    case "accent-left": return `3px solid ${accent}`;
  }
}

function densityPadding(density: ThemePersonality["contentDensity"]): string {
  switch (density) {
    case "compact": return "3.5%";
    case "normal": return "5%";
    case "spacious": return "7%";
  }
}

function scaledPx(basePx: number, scale: number): number {
  return Math.round(basePx * scale);
}

function buildDecorationCSS(p: ThemePersonality, theme: PresentationTheme): string {
  const parts: string[] = [];
  const accent = theme.colors.accent;
  const secondary = theme.colors.secondary ?? theme.colors.accent;

  // Title underline
  if (p.decorations.titleUnderline !== "none") {
    const height = p.decorations.titleUnderline === "thick" ? "4px" : p.decorations.titleUnderline === "accent-gradient" ? "3px" : "2px";
    const bg = p.decorations.titleUnderline === "accent-gradient"
      ? `linear-gradient(90deg, ${accent}, ${secondary})`
      : accent;
    parts.push(`
.slide h2::after {
  content: '';
  display: block;
  width: 60px;
  height: ${height};
  background: ${bg};
  margin-top: 12px;
  border-radius: 2px;
  ${p.titleAlign === "center" ? "margin-left: auto; margin-right: auto;" : ""}
}
`);
  }

  // Section divider
  if (p.decorations.sectionDivider === "line") {
    parts.push(`
.section-divider .slide-inner::after {
  content: '';
  position: absolute;
  bottom: 10%;
  ${p.titleAlign === "center" ? "left: 35%; right: 35%;" : "left: 5%; width: 80px;"}
  height: 2px;
  background: ${accent};
  opacity: 0.3;
}
`);
  } else if (p.decorations.sectionDivider === "dots") {
    parts.push(`
.section-divider .slide-inner::after {
  content: '● ● ●';
  position: absolute;
  bottom: 10%;
  ${p.titleAlign === "center" ? "left: 0; right: 0; text-align: center;" : "left: 5%;"}
  font-size: 8px;
  letter-spacing: 6px;
  color: ${accent};
  opacity: 0.5;
}
`);
  } else if (p.decorations.sectionDivider === "geometric") {
    parts.push(`
.section-divider .slide-inner::after {
  content: '';
  position: absolute;
  bottom: 8%;
  right: 8%;
  width: 40px;
  height: 40px;
  border: 2px solid ${accent};
  opacity: 0.15;
  transform: rotate(45deg);
}
`);
  }

  // Accent shape
  if (p.decorations.accentShape === "triangle") {
    parts.push(`
.cover .slide-inner::before {
  content: '';
  position: absolute;
  top: -40px;
  right: -40px;
  width: 200px;
  height: 200px;
  background: ${accent};
  opacity: 0.08;
  clip-path: polygon(100% 0, 0 0, 100% 100%);
  pointer-events: none;
}
`);
  } else if (p.decorations.accentShape === "circle") {
    parts.push(`
.cover .slide-inner::before {
  content: '';
  position: absolute;
  top: -60px;
  right: -60px;
  width: 180px;
  height: 180px;
  background: ${accent};
  opacity: 0.06;
  border-radius: 50%;
  pointer-events: none;
}
`);
  } else if (p.decorations.accentShape === "square") {
    parts.push(`
.cover .slide-inner::before {
  content: '';
  position: absolute;
  bottom: -20px;
  left: -20px;
  width: 120px;
  height: 120px;
  background: ${accent};
  opacity: 0.08;
  pointer-events: none;
}
.closing .slide-inner::before {
  content: '';
  position: absolute;
  top: -20px;
  right: -20px;
  width: 120px;
  height: 120px;
  background: ${accent};
  opacity: 0.08;
  pointer-events: none;
}
`);
  } else if (p.decorations.accentShape === "wave") {
    parts.push(`
.cover .slide-inner::after,
.closing .slide-inner::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 6px;
  background: linear-gradient(90deg, ${accent}, ${secondary}, ${accent});
  border-radius: 3px;
  pointer-events: none;
}
`);
  }

  return parts.join("\n");
}

/* === Animation CSS builder === */

function buildAnimationCSS(level: AnimationLevel): string {
  if (level === "none") return "";

  const config: Record<Exclude<AnimationLevel, "none">, { duration: number; translate: number; stagger: number; easing: string }> = {
    subtle:   { duration: 300, translate: 0,  stagger: 100, easing: "ease" },
    moderate: { duration: 400, translate: 8,  stagger: 150, easing: "ease" },
    dynamic:  { duration: 500, translate: 20, stagger: 200, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
  };

  const c = config[level];

  let css = `
/* Animation Variables */
:root {
  --anim-duration: ${c.duration}ms;
  --anim-translate: ${c.translate}px;
  --anim-stagger: ${c.stagger}ms;
  --anim-easing: ${c.easing};
}

/* Per-slide speed overrides */
[data-speed="slow"]  { --anim-duration: 600ms; --anim-stagger: 250ms; }
[data-speed="fast"]  { --anim-duration: 200ms; --anim-stagger: 80ms; }

/* Entrance keyframes */
@keyframes entrance-fade {
  from { opacity: 0; } to { opacity: 1; }
}
@keyframes entrance-slide-up {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes entrance-slide-left {
  from { opacity: 0; transform: translateX(-30px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes entrance-zoom {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

/* Entrance activation on active slide */
.slide.active[data-entrance="fade"] .slide-inner      { animation: entrance-fade var(--anim-duration) var(--anim-easing) both; }
.slide.active[data-entrance="slide-up"] .slide-inner   { animation: entrance-slide-up var(--anim-duration) var(--anim-easing) both; }
.slide.active[data-entrance="slide-left"] .slide-inner { animation: entrance-slide-left var(--anim-duration) var(--anim-easing) both; }
.slide.active[data-entrance="zoom"] .slide-inner       { animation: entrance-zoom var(--anim-duration) var(--anim-easing) both; }

/* Fragments visible by default (browse mode) */
.slide.active .fragment {
  opacity: 1;
  transition: opacity var(--anim-duration) var(--anim-easing),
              transform var(--anim-duration) var(--anim-easing);
}

/* Fragment hidden state (present mode only) */
body.present-mode .slide.active .fragment {
  opacity: 0;
}

/* Fragment visible state */
.slide.active .fragment.visible {
  opacity: 1 !important;
  transform: translateY(0) translateX(0) scale(1) rotateX(0deg) !important;
}

/* Fragment style transforms (present mode only) */
body.present-mode [data-fragment="fade"] .fragment { transform: none; }
body.present-mode [data-fragment="slide-up"] .fragment { transform: translateY(var(--anim-translate)); }
body.present-mode [data-fragment="slide-left"] .fragment { transform: translateX(calc(var(--anim-translate) * -1)); }
body.present-mode [data-fragment="flip"] .fragment {
  transform: perspective(400px) rotateX(10deg);
  transform-origin: top center;
}
body.present-mode [data-fragment="zoom"] .fragment {
  transform: scale(0.85);
}
`;

  // Stagger delays for nth-child (up to 20)
  for (let i = 1; i <= 20; i++) {
    const delay = i === 1 ? "0ms" : `calc(var(--anim-stagger) * ${i - 1})`;
    css += `.slide.active .fragment:nth-child(${i}) { transition-delay: ${delay}; }\n`;
  }

  return css;
}

/* === Print CSS builder === */

function buildPrintCSS(): string {
  return `
@media print {
  .viewport { transform: none !important; overflow: visible !important; }
  .slide-deck { overflow: visible !important; }
  .slide {
    page-break-after: always;
    break-after: page;
    position: relative !important;
    display: block !important;
    width: 1280px !important;
    height: 720px !important;
    transform: none !important;
  }
  .slide .fragment { opacity: 1 !important; transform: none !important; transition: none !important; }
  .slide .slide-inner { animation: none !important; }
  .nav-bar, .nav-title, #progress-bar, #present-btn, #exit-btn, #fragment-progress { display: none !important; }
}
`;
}

/* === Main CSS builder === */

export function buildCSS(
  theme: PresentationTheme,
  settings?: SlideSettings
): string {
  const c = theme.colors;
  const f = theme.fonts;
  const secondary = c.secondary ?? c.accent;
  const cardBg = c.cardBg ?? (theme.isDark ? "rgba(30,41,59,0.85)" : "rgba(0,0,0,0.04)");
  const barColors = c.barColors ?? ["#3B82F6","#10B981","#A78BFA","#F59E0B","#EF4444","#EC4899","#06B6D4"];

  const bgRule = c.bg.startsWith("linear") ? `background: ${c.bg};` : `background-color: ${c.bg};`;
  const borderSubtle = theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";
  const btnBorder = theme.isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)";
  const btnHoverBg = theme.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)";
  const trackBg = theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";

  // Personality + custom params
  const p = theme.personality;
  const params: CustomParams = settings?.customParams ?? DEFAULT_CUSTOM_PARAMS;
  const pad = densityPadding(p.contentDensity);

  // Scaled font sizes
  const titleSize = scaledPx(48, params.titleScale);
  const subtitleSize = scaledPx(28, params.subtitleScale);
  const bodySize = scaledPx(22, params.bodyScale);
  const smallSize = scaledPx(16, params.bodyScale);
  const cardPad = scaledPx(28, params.cardScale);
  const gapSize = scaledPx(24, params.spacingScale);

  // Personality-driven values
  const shadowVal = shadowValue(p.shadowDepth, theme.isDark);
  const borderVal = borderValue(p.borderStyle, c.accent, theme.isDark);
  const titleAlign = p.titleAlign === "top-left" ? "left" : p.titleAlign;

  // Glass card background
  const glassBg = theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.45)";
  const glassBorder = theme.isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.5)";

  const decorCSS = buildDecorationCSS(p, theme);

  return `
/* === CSS Variables === */
:root {
  --slide-bg: ${c.bg};
  --slide-text: ${c.text};
  --slide-accent: ${c.accent};
  --slide-secondary: ${secondary};
  --slide-muted: ${c.muted};
  --slide-card-bg: ${cardBg};
  --font-heading: ${f.heading};
  --font-body: ${f.body};
  --font-mono: ${f.mono ?? "monospace"};
  ${barColors.map((color, i) => `--bar-${i}: ${color};`).join("\n  ")}
  --slide-title-align: ${titleAlign};
  --slide-border-radius: ${p.borderRadius}px;
  --slide-card-radius: ${p.borderRadius}px;
  --slide-shadow: ${shadowVal};
  --slide-border: ${borderVal};
  --title-size: ${titleSize}px;
  --subtitle-size: ${subtitleSize}px;
  --body-size: ${bodySize}px;
  --small-size: ${smallSize}px;
  --card-padding: ${cardPad}px;
  --gap-size: ${gapSize}px;
  --slide-padding: ${pad};
}

/* === Reset & Base === */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 100%; height: 100%; overflow: hidden; }
body {
  font-family: var(--font-body);
  color: var(--slide-text);
  ${bgRule}
  -webkit-font-smoothing: antialiased;
}

/* === Viewport & Fixed Canvas === */
.viewport {
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
}
.slide-deck {
  width: 1280px;
  height: 720px;
  position: absolute;
  left: 50%;
  top: 50%;
  transform-origin: center center;
  /* transform set by JS via slide-engine-nav */
}
.slide {
  width: 1280px;
  height: 720px;
  position: absolute;
  top: 0;
  left: 0;
  display: none;
  overflow: hidden;
  ${bgRule}
}
.slide.active { display: flex; }
.slide-inner {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: var(--slide-padding);
  justify-content: center;
  gap: var(--gap-size);
  position: relative;
}

/* === Typography === */
.slide h1 { font-family: var(--font-heading); font-size: ${scaledPx(64, params.titleScale)}px; font-weight: 700; line-height: 1.1; color: var(--slide-accent); text-align: var(--slide-title-align); }
.slide h2 { font-family: var(--font-heading); font-size: var(--title-size); font-weight: 700; line-height: 1.2; color: var(--slide-accent); margin-bottom: var(--gap-size); text-align: var(--slide-title-align); }
.slide h3 { font-family: var(--font-heading); font-size: ${scaledPx(24, params.titleScale)}px; font-weight: 600; line-height: 1.3; color: var(--slide-accent); }
.slide p, .slide li { font-size: var(--body-size); line-height: 1.6; }
.slide .subtitle { font-size: var(--subtitle-size); color: var(--slide-muted); margin-top: 12px; }
.slide .footnote { font-size: var(--small-size); color: var(--slide-muted); margin-top: auto; padding-top: 20px; }
.slide .badge { font-size: ${scaledPx(12, params.badgeScale)}px; letter-spacing: ${scaledPx(3, params.badgeScale)}px; text-transform: uppercase; color: var(--slide-muted); position: absolute; z-index: 2; }
.badge-top-left     { top: var(--slide-padding); left: var(--slide-padding); }
.badge-top-center   { top: var(--slide-padding); left: 50%; transform: translateX(-50%); }
.badge-top-right    { top: var(--slide-padding); right: var(--slide-padding); }
.badge-bottom-left  { bottom: var(--slide-padding); left: var(--slide-padding); }
.badge-bottom-center{ bottom: var(--slide-padding); left: 50%; transform: translateX(-50%); }
.badge-bottom-right { bottom: var(--slide-padding); right: var(--slide-padding); }
/* === Text Alignment (per-slide) === */
.slide[data-text-align="left"] .slide-inner { text-align: left; align-items: flex-start; }
.slide[data-text-align="left"] h1,
.slide[data-text-align="left"] h2 { text-align: left; }
.slide[data-text-align="right"] .slide-inner { text-align: right; align-items: flex-end; }
.slide[data-text-align="right"] h1,
.slide[data-text-align="right"] h2 { text-align: right; }
.slide .body-text { font-size: var(--body-size); line-height: 1.7; max-width: 800px; }
.slide .item-desc { color: var(--slide-muted); font-weight: 400; }

/* === Template CSS (from plugins) === */
${buildAllTemplateCSS()}

/* === Dynamic theme overrides (values computed from theme + params) === */
.cover h1 { font-size: ${scaledPx(56, params.titleScale)}px; text-align: center; }
.cover.gradient { ${c.bg.startsWith("linear") ? "" : `background: linear-gradient(135deg, ${c.accent}15, ${secondary}15);`} }

.section-divider.dark { background-color: ${theme.isDark ? c.accent : c.text}; }
.section-divider.dark h2, .section-divider.dark .section-label { color: ${theme.isDark ? c.bg : "#FFFFFF"}; }
.section-divider .section-title { font-size: ${scaledPx(44, params.titleScale)}px; }
.section-divider.accent { background-color: var(--slide-accent); }
.section-divider.accent h2, .section-divider.accent .section-label { color: ${theme.isDark ? c.bg : "#FFFFFF"}; }

.content-list .num { font-size: ${scaledPx(28, params.titleScale)}px; font-weight: 700; color: var(--slide-accent); min-width: 32px; font-family: var(--font-heading); }

/* === Card Styles (personality-driven) === */
.story-card, .stat-card, .content-card, .quote-card, .compare-col {
  border-radius: var(--slide-card-radius);
  padding: var(--card-padding);
  box-shadow: var(--slide-shadow);
  ${p.borderStyle === "accent-left"
    ? `border-left: var(--slide-border); border-top: none; border-right: none; border-bottom: none;`
    : `border: var(--slide-border);`}
}

/* Solid card bg (default) */
.card-solid .story-card, .card-solid .stat-card,
.card-solid .content-card, .card-solid .quote-card, .card-solid .compare-col {
  background: var(--slide-card-bg);
}

/* Glass card bg */
.card-glass .story-card, .card-glass .stat-card,
.card-glass .content-card, .card-glass .quote-card, .card-glass .compare-col {
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  background: ${glassBg};
  border: 1px solid ${glassBorder};
}

.col-title { font-size: ${scaledPx(22, params.titleScale)}px; margin-bottom: 12px; }
.col-list li { border-bottom: 1px solid ${borderSubtle}; }

.bar-track { background: ${trackBg}; }
.big-value { font-size: ${scaledPx(88, params.titleScale)}px; }
.stat-value { font-size: ${scaledPx(64, params.titleScale)}px; }
.compare-col li { border-bottom: 1px solid ${borderSubtle}; }

.quote-text { font-size: ${scaledPx(28, params.bodyScale)}px; }
.quote.fullscreen .quote-text { font-size: ${scaledPx(34, params.bodyScale)}px; }
.quote.card-overlay .quote-text { font-size: ${scaledPx(24, params.bodyScale)}px; }

.card-icon { font-size: ${scaledPx(28, params.cardScale)}px; display: block; margin-bottom: 10px; }
.card-title { font-size: ${scaledPx(20, params.cardScale)}px; }

.closing h1 { font-size: ${scaledPx(56, params.titleScale)}px; margin-bottom: 20px; text-align: center; }
.cta-text { font-size: ${scaledPx(20, params.bodyScale)}px; }

/* === Decorations === */
${decorCSS}

/* === Fragment base (always visible in browse mode) === */
.fragment { opacity: 1; transform: none; }

/* === Background Image Support === */
.slide[data-bg] { background-size: cover; background-position: center; }
.slide[data-bg]::before { content: ""; position: absolute; inset: 0; z-index: 0; }
.slide.overlay-dark[data-bg]::before { background: rgba(0,0,0,0.55); }
.slide.overlay-light[data-bg]::before { background: rgba(255,255,255,0.4); }
.slide.overlay-gradient[data-bg]::before { background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 60%); }
.slide[data-bg] > * { position: relative; z-index: 1; }

/* === Split Layout === */
.split-layout { display: grid; width: 100%; height: 100%; }
.split-layout.horizontal { grid-template-columns: 1fr 1fr; }
.split-layout.vertical { grid-template-rows: 1fr 1fr; }
.image-panel { overflow: hidden; position: relative; padding: 16px; }
.image-panel img { width: 100%; height: 100%; object-fit: cover; display: block; border-radius: 12px; }
.image-panel img.contain { object-fit: contain; background: rgba(255,255,255,0.03); }
.content-panel { display: flex; flex-direction: column; justify-content: center; overflow: hidden; }
.content-panel > .slide-inner { height: 100%; }
.split-layout[data-img-pos="left"] .image-panel { order: -1; }
.split-layout[data-img-pos="top"] .image-panel { order: -1; }

/* Overlay Layout */
.overlay-layout { position: relative; width: 100%; height: 100%; background-size: cover; background-position: center; }
.overlay-mask { position: absolute; inset: 0; z-index: 0; }
.overlay-mask.dark { background: rgba(0,0,0,var(--overlay-opacity, 0.55)); }
.overlay-mask.light { background: rgba(255,255,255,var(--overlay-opacity, 0.4)); }
.overlay-mask.gradient { background: linear-gradient(to top, rgba(0,0,0,var(--overlay-opacity, 0.8)) 0%, transparent 60%); }
.overlay-layout > .content-panel { position: relative; z-index: 1; height: 100%; }

/* === Navigation UI (viewport-level) === */
.nav-bar { position: fixed; bottom: 0; left: 0; right: 0; height: 40px; display: flex; align-items: center; gap: 8px; padding: 0 20px; background: rgba(0,0,0,0.5); backdrop-filter: blur(8px); z-index: 100; }
.nav-title { font-size: 12px; color: var(--slide-muted); opacity: 0.6; position: fixed; top: 12px; left: 20px; font-family: var(--font-body); z-index: 100; }
.progress-bar { position: fixed; bottom: 0; left: 0; height: 3px; background: var(--slide-accent); transition: width 0.3s ease; z-index: 101; }
#page-counter { font-size: 13px; color: var(--slide-muted); font-family: var(--font-mono); }
.nav-bar button { background: none; border: 1px solid ${btnBorder}; color: var(--slide-muted); width: 32px; height: 32px; border-radius: 6px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; }
.nav-bar button:hover { background: ${btnHoverBg}; color: var(--slide-text); }
#present-btn, #exit-btn { width: auto; height: auto; font-size: 13px; padding: 4px 12px; }
#fragment-progress { font-size: 12px; letter-spacing: 2px; color: var(--slide-muted); opacity: 0.7; }
` + buildAnimationCSS(settings?.animationLevel ?? "none") + buildPrintCSS();
}

/**
 * Generate CSS overrides for a single slide's custom params.
 * Uses #slide-N selector to scope styles to that specific slide.
 */
export function buildSlideOverrideCSS(
  slideIndex: number,
  overrides: Partial<CustomParams>,
  globalParams?: CustomParams,
): string {
  const base = globalParams ?? DEFAULT_CUSTOM_PARAMS;
  const rules: string[] = [];
  const sel = `.slide[data-index="${slideIndex}"]`;

  // === titleScale: main titles, big numbers, statement text ===
  if (overrides.titleScale && overrides.titleScale !== base.titleScale) {
    const s = overrides.titleScale;
    // General headings (exclude card/column h3 — those go to subtitleScale)
    rules.push(`${sel} h1 { font-size: ${scaledPx(64, s)}px !important; }`);
    rules.push(`${sel} h2, ${sel} .slide-title { font-size: ${scaledPx(48, s)}px !important; }`);
    rules.push(`${sel} h3:not(.card-title):not(.col-title):not(.icon-card h3):not(.tc-card-body h3):not(.ig-title) { font-size: ${scaledPx(24, s)}px !important; }`);
    // Template-specific main titles
    rules.push(`${sel}.cover h1 { font-size: ${scaledPx(56, s)}px !important; }`);
    rules.push(`${sel}.closing h1 { font-size: ${scaledPx(56, s)}px !important; }`);
    rules.push(`${sel} .section-title { font-size: ${scaledPx(44, s)}px !important; }`);
    rules.push(`${sel} .statement-text { font-size: ${scaledPx(44, s)}px !important; }`);
    // Big numbers (dataviz)
    rules.push(`${sel} .big-value { font-size: ${scaledPx(88, s)}px !important; }`);
    rules.push(`${sel} .stat-value { font-size: ${scaledPx(64, s)}px !important; }`);
  }

  // === subtitleScale: subtitles, column titles, card titles, labels ===
  if (overrides.subtitleScale && overrides.subtitleScale !== base.subtitleScale) {
    const s = overrides.subtitleScale;
    rules.push(`${sel} .subtitle { font-size: ${scaledPx(28, s)}px !important; }`);
    // Section divider label
    rules.push(`${sel} .section-label { font-size: ${scaledPx(20, s)}px !important; }`);
    // Two-column titles
    rules.push(`${sel} .col-title { font-size: ${scaledPx(24, s)}px !important; }`);
    // Comparison labels & titles
    rules.push(`${sel} .comparison-col-title { font-size: ${scaledPx(22, s)}px !important; }`);
    rules.push(`${sel} .comparison-label { font-size: ${scaledPx(16, s)}px !important; }`);
    // Dataviz labels
    rules.push(`${sel} .big-label { font-size: ${scaledPx(24, s)}px !important; }`);
    rules.push(`${sel} .stat-label { font-size: ${scaledPx(20, s)}px !important; }`);
    // Story-cards title
    rules.push(`${sel} .card-title { font-size: ${scaledPx(20, s)}px !important; }`);
    // Icon-grid card title
    rules.push(`${sel} .icon-card h3, ${sel} .ig-title { font-size: ${scaledPx(20, s)}px !important; }`);
    // Title-cards card title
    rules.push(`${sel} .tc-card-body h3 { font-size: ${scaledPx(20, s)}px !important; }`);
  }

  // === bodyScale: body text, lists, descriptions, footnotes, captions ===
  if (overrides.bodyScale && overrides.bodyScale !== base.bodyScale) {
    const s = overrides.bodyScale;
    // General text
    rules.push(`${sel} p:not(.subtitle):not(.section-label), ${sel} li, ${sel} .desc { font-size: ${scaledPx(22, s)}px !important; }`);
    rules.push(`${sel} small, ${sel} .footnote { font-size: ${scaledPx(16, s)}px !important; }`);
    // Quote
    rules.push(`${sel} .quote-text { font-size: ${scaledPx(28, s)}px !important; }`);
    rules.push(`${sel} .quote-author { font-size: ${scaledPx(16, s)}px !important; }`);
    // Closing CTA
    rules.push(`${sel} .cta-text { font-size: ${scaledPx(22, s)}px !important; }`);
    // Dataviz bar labels
    rules.push(`${sel} .bar-label { font-size: ${scaledPx(16, s)}px !important; }`);
    rules.push(`${sel} .bar-value { font-size: ${scaledPx(16, s)}px !important; }`);
    // Comparison body
    rules.push(`${sel} .comparison-items li { font-size: ${scaledPx(22, s)}px !important; }`);
    rules.push(`${sel} .comparison-col-body { font-size: ${scaledPx(22, s)}px !important; }`);
    // Story-cards body
    rules.push(`${sel} .card-body { font-size: ${scaledPx(18, s)}px !important; }`);
    // Icon-grid body
    rules.push(`${sel} .icon-card p, ${sel} .ig-body { font-size: ${scaledPx(18, s)}px !important; }`);
    // Statement body
    rules.push(`${sel} .statement-body { font-size: ${scaledPx(22, s)}px !important; }`);
    // Image-showcase caption
    rules.push(`${sel} .is-caption { font-size: ${scaledPx(16, s)}px !important; }`);
    // Title-cards body
    rules.push(`${sel} .tc-card-body p { font-size: ${scaledPx(16, s)}px !important; }`);
  }

  // === cardScale: card/column padding ===
  if (overrides.cardScale && overrides.cardScale !== base.cardScale) {
    const s = overrides.cardScale;
    rules.push(`${sel} .card, ${sel} .story-card { padding: ${scaledPx(28, s)}px !important; }`);
    rules.push(`${sel} .icon-card { padding: ${scaledPx(20, s)}px !important; }`);
    rules.push(`${sel} .icon-card .ig-icon, ${sel} .card-icon { font-size: ${scaledPx(28, s)}px !important; }`);
    rules.push(`${sel} .comparison-left, ${sel} .comparison-right, ${sel} .comparison-col, ${sel} .compare-col { padding: ${scaledPx(24, s)}px !important; }`);
    rules.push(`${sel} .tc-card-body { padding: ${scaledPx(16, s)}px !important; }`);
    rules.push(`${sel} .col { padding: ${scaledPx(20, s)}px !important; }`);
  }

  // === badgeScale ===
  if (overrides.badgeScale && overrides.badgeScale !== base.badgeScale) {
    const s = overrides.badgeScale;
    rules.push(`${sel} .badge { font-size: ${scaledPx(13, s)}px !important; padding: ${scaledPx(5, s)}px ${scaledPx(14, s)}px !important; }`);
  }

  return rules.length > 0 ? `/* slide ${slideIndex} overrides */\n${rules.join("\n")}` : "";
}
