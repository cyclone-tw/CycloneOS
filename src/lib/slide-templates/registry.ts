// dashboard/src/lib/slide-templates/registry.ts
// Template plugin registry — register, lookup, render, and auto-generate prompt helpers.

import type { SlideAnimation, SlideContent } from "@/stores/presentations-store";
import type { FieldConfig, TemplatePlugin } from "./types";
import { wrapWithLayout } from "./helpers";

// ---------------------------------------------------------------------------
// Internal registry store
// ---------------------------------------------------------------------------

const plugins = new Map<string, TemplatePlugin>();

// ---------------------------------------------------------------------------
// Registration & lookup
// ---------------------------------------------------------------------------

/** Register a template plugin. Overwrites if the same type is registered again. */
export function registerTemplate(plugin: TemplatePlugin): void {
  plugins.set(plugin.type, plugin);
}

/** Get a single plugin by its slide type string. */
export function getPlugin(type: string): TemplatePlugin | undefined {
  return plugins.get(type);
}

/** Return all registered plugins (in insertion order). */
export function getAllPlugins(): TemplatePlugin[] {
  return Array.from(plugins.values());
}

/** Return the field config array for a given slide type. */
export function getTemplateFields(type: string): FieldConfig[] {
  return plugins.get(type)?.fields ?? [];
}

// ---------------------------------------------------------------------------
// CSS collection
// ---------------------------------------------------------------------------

/** Collect CSS from every registered plugin into a single string. */
export function buildAllTemplateCSS(): string {
  return getAllPlugins()
    .map((p) => p.styles())
    .filter(Boolean)
    .join("\n\n");
}

// ---------------------------------------------------------------------------
// Main render function — mirrors the original slideToHtml exactly
// ---------------------------------------------------------------------------

/**
 * Convert a SlideContent to HTML.
 *
 * 1. Delegate to the matching plugin's render().
 * 2. Inject animation data attributes (entrance, fragmentStyle, speed).
 * 3. Inject text-alignment data attribute when not "center".
 * 4. Wrap with split/overlay layout when configured.
 *
 * Falls back to the "content" plugin when no match is found.
 */
export function slideToHtml(
  slide: SlideContent,
  index: number,
  total: number,
  animation?: SlideAnimation,
): string {
  const plugin = plugins.get(slide.slideType) ?? plugins.get("content");
  if (!plugin) {
    // Absolute fallback — should never happen once content plugin is registered
    return `<div class="slide content" data-index="${index}"><div class="slide-inner content-inner"><h2>${slide.title ?? ""}</h2></div></div>`;
  }

  let html = plugin.render(slide, index, total);

  // Inject animation data attributes onto the root .slide element
  if (animation) {
    html = html.replace(
      /^(<div class="slide[^"]*")/,
      `$1 data-entrance="${animation.entrance}" data-fragment="${animation.fragmentStyle}" data-speed="${animation.speed}"`,
    );
  }

  // Inject text alignment
  if (slide.textAlign && slide.textAlign !== "center") {
    html = html.replace(
      /^(<div class="slide[^"]*")/,
      `$1 data-text-align="${slide.textAlign}"`,
    );
  }

  // Wrap with layout (split/overlay)
  if (slide.layout && slide.layout.mode !== "default") {
    html = html.replace(
      /(<div class="slide[^>]*>)\s*([\s\S]*)\s*(<\/div>)\s*$/,
      (_, openTag, inner, closeTag) =>
        `${openTag}\n${wrapWithLayout(inner.trim(), slide.layout)}\n${closeTag}`,
    );
  }

  return html;
}

// ---------------------------------------------------------------------------
// Prompt auto-generation helpers
// ---------------------------------------------------------------------------

/**
 * Auto-generate a decision tree from all registered plugins.
 * Useful for LLM prompts so the model knows which slide types + variants exist.
 */
export function buildPromptDecisionTree(): string {
  const lines: string[] = [];
  for (const p of getAllPlugins()) {
    const variants = p.variants.map((v) => `${v.id} (${v.label})`).join(", ");
    lines.push(`- **${p.type}** (${p.label}): ${p.promptDescription}`);
    lines.push(`  Variants: ${variants}`);
  }
  return lines.join("\n");
}

/**
 * Auto-generate a content-fields table from all registered plugins.
 * Useful for LLM prompts so the model knows which JSON fields to emit per type.
 */
export function buildContentFieldsTable(): string {
  const lines: string[] = [];
  for (const p of getAllPlugins()) {
    lines.push(`| ${p.type} | ${p.contentFields} |`);
  }
  return `| slideType | contentFields |\n|-----------|---------------|\n${lines.join("\n")}`;
}
