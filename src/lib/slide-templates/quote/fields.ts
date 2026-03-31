import type { FieldConfig } from "../types";

export const quoteFields: FieldConfig[] = [
  { key: "quote", type: "textarea", label: "引言", placeholder: "引用文字" },
  { key: "body", type: "textarea", label: "補充說明", placeholder: "引言的補充說明" },
];
