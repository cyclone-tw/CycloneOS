// dashboard/src/lib/slide-templates/types.ts
// Plugin type definitions for the slide template system.

import type { SlideContent, SlideAnimation } from "@/stores/presentations-store";

export interface FieldConfig {
  key: string;
  type:
    | "text"
    | "textarea"
    | "items"
    | "cards"
    | "columns"
    | "images"
    | "image"
    | "icon-picker"
    | "highlight-lines";
  label: string;
  placeholder?: string;
  required?: boolean;
}

export interface VariantDef {
  id: string;
  label: string;
}

export interface TemplatePlugin {
  type: string;
  label: string;
  icon: string;
  variants: VariantDef[];
  defaultVariant: string;

  render: (slide: SlideContent, index: number, total: number) => string;
  styles: () => string;
  fields: FieldConfig[];

  promptDescription: string;
  contentFields: string;
}
