import type { FieldConfig } from "../types";

export const sectionDividerFields: FieldConfig[] = [
  { key: "title", type: "text", label: "標題", placeholder: "章節標題", required: true },
  { key: "subtitle", type: "text", label: "副標題", placeholder: "章節說明" },
];
