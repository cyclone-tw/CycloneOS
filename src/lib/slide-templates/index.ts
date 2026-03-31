// dashboard/src/lib/slide-templates/index.ts
// Barrel export for the slide template plugin system.
// Imports all 13 built-in template plugins and registers them.

// Types
export type { FieldConfig, VariantDef, TemplatePlugin } from "./types";

// Shared helpers
export {
  esc,
  nl2br,
  frag,
  bgStyle,
  overlayClass,
  badgeHtml,
  getImageSrc,
  wrapWithLayout,
} from "./helpers";

// Registry & render
export {
  registerTemplate,
  getPlugin,
  getAllPlugins,
  getTemplateFields,
  buildAllTemplateCSS,
  slideToHtml,
  buildPromptDecisionTree,
  buildContentFieldsTable,
} from "./registry";

// ---------------------------------------------------------------------------
// Auto-register all built-in template plugins
// ---------------------------------------------------------------------------

import { registerTemplate } from "./registry";

import coverPlugin from "./cover";
import sectionDividerPlugin from "./section-divider";
import contentPlugin from "./content";
import twoColumnPlugin from "./two-column";
import datavizPlugin from "./dataviz";
import quotePlugin from "./quote";
import storyCardsPlugin from "./story-cards";
import closingPlugin from "./closing";
import imageShowcasePlugin from "./image-showcase";
import iconGridPlugin from "./icon-grid";
import statementPlugin from "./statement";
import comparisonPlugin from "./comparison";
import titleCardsPlugin from "./title-cards";

registerTemplate(coverPlugin);
registerTemplate(sectionDividerPlugin);
registerTemplate(contentPlugin);
registerTemplate(twoColumnPlugin);
registerTemplate(datavizPlugin);
registerTemplate(quotePlugin);
registerTemplate(storyCardsPlugin);
registerTemplate(closingPlugin);
registerTemplate(imageShowcasePlugin);
registerTemplate(iconGridPlugin);
registerTemplate(statementPlugin);
registerTemplate(comparisonPlugin);
registerTemplate(titleCardsPlugin);
