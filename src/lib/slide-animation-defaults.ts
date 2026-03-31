import type { SlideAnimation, SlideDefinition, SlideType } from "@/stores/presentations-store";

export const ANIMATION_DEFAULTS: Record<SlideType, SlideAnimation> = {
  cover:              { entrance: "zoom",       fragmentStyle: "fade",       speed: "normal" },
  "section-divider":  { entrance: "slide-left", fragmentStyle: "fade",       speed: "normal" },
  content:            { entrance: "fade",       fragmentStyle: "slide-up",   speed: "normal" },
  "two-column":       { entrance: "fade",       fragmentStyle: "slide-left", speed: "normal" },
  dataviz:            { entrance: "fade",       fragmentStyle: "slide-up",   speed: "normal" },
  quote:              { entrance: "fade",       fragmentStyle: "fade",       speed: "slow"   },
  "story-cards":      { entrance: "fade",       fragmentStyle: "zoom",       speed: "normal" },
  closing:            { entrance: "fade",       fragmentStyle: "fade",       speed: "normal" },
  "image-showcase":   { entrance: "fade",       fragmentStyle: "zoom",       speed: "normal" },
  "icon-grid":        { entrance: "fade",       fragmentStyle: "slide-up",   speed: "normal" },
  statement:          { entrance: "zoom",       fragmentStyle: "fade",       speed: "slow"   },
  comparison:         { entrance: "fade",       fragmentStyle: "slide-left", speed: "normal" },
  "title-cards":      { entrance: "fade",       fragmentStyle: "slide-up",   speed: "normal" },
};

export function getSlideAnimation(slide: SlideDefinition): SlideAnimation {
  return slide.animation ?? ANIMATION_DEFAULTS[slide.content.slideType];
}
