// dashboard/src/lib/slide-templates/helpers.ts
// Shared helper functions extracted from slide-templates.ts.
// Used by all template plugins.

import type { SlideContent, SlideLayout } from "@/stores/presentations-store";

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

/** HTML-escape a string. Returns "" for null/undefined. */
export function esc(str: unknown): string {
  if (str == null) return "";
  const s = String(str);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Convert newlines to <br> tags. Apply AFTER esc() to avoid escaping the <br>. */
export function nl2br(str: string): string {
  return str.replace(/\n/g, "<br>");
}

/** Wrap content in a .fragment div (or custom tag). */
export function frag(content: string, tag = "div"): string {
  return `<${tag} class="fragment">${content}</${tag}>`;
}

// ---------------------------------------------------------------------------
// Slide attribute helpers
// ---------------------------------------------------------------------------

/** Build inline style for background image (data-bg + background-image). */
export function bgStyle(slide: SlideContent): string {
  if (!slide.backgroundImage?.url) return "";
  return ` data-bg style="background-image:url('${esc(slide.backgroundImage.url)}')"`;
}

/** Build overlay CSS class for background image. */
export function overlayClass(slide: SlideContent): string {
  if (!slide.backgroundImage?.url) return "";
  return ` overlay-${slide.backgroundImage.overlay ?? "dark"}`;
}

/** Build badge HTML with position class. */
export function badgeHtml(slide: SlideContent): string {
  if (!slide.badge) return "";
  const pos = slide.badgePosition ?? "top-center";
  return `<div class="badge badge-${pos}">${esc(slide.badge)}</div>`;
}

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

/** Extract image src from a SlideImage (base64 > url > ""). */
export function getImageSrc(image: SlideLayout["image"]): string {
  if (!image) return "";
  if (image.base64) return image.base64;
  if (image.url) return esc(image.url);
  return "";
}

/** Wrap slide HTML with a split/overlay layout if configured. */
export function wrapWithLayout(html: string, layout?: SlideLayout): string {
  if (!layout || layout.mode === "default") return html;

  const image = layout.image;
  const src = getImageSrc(image);
  if (!src && layout.mode !== "image-overlay") return html;

  const fit = image?.fit ?? "cover";
  const fitClass = fit === "contain" ? ' class="contain"' : "";
  const imgTag = src ? `<img src="${src}"${fitClass} alt="" />` : "";

  if (layout.mode === "split-horizontal") {
    const ratio = layout.splitRatio ?? 50;
    const pos = layout.imagePosition ?? "right";
    const contentFr = 100 - ratio;
    return `<div class="split-layout horizontal" data-img-pos="${pos}" style="grid-template-columns: ${contentFr}fr ${ratio}fr">
  <div class="content-panel">${html}</div>
  <div class="image-panel">${imgTag}</div>
</div>`;
  }

  if (layout.mode === "split-vertical") {
    const ratio = layout.splitRatio ?? 50;
    const pos = layout.imagePosition ?? "top";
    const contentFr = 100 - ratio;
    return `<div class="split-layout vertical" data-img-pos="${pos}" style="grid-template-rows: ${contentFr}fr ${ratio}fr">
  <div class="content-panel">${html}</div>
  <div class="image-panel">${imgTag}</div>
</div>`;
  }

  if (layout.mode === "image-overlay") {
    const overlay = image?.overlay ?? "dark";
    const opacity = image?.overlayOpacity;
    const opacityStyle = opacity !== undefined ? `--overlay-opacity:${opacity};` : "";
    const bgSrc = src ? `background-image:url('${src}')` : "";
    return `<div class="overlay-layout" style="${bgSrc};background-size:cover;background-position:center">
  <div class="overlay-mask ${overlay}" style="${opacityStyle}"></div>
  <div class="content-panel">${html}</div>
</div>`;
  }

  return html;
}
