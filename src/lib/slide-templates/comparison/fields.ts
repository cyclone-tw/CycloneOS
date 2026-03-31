import type { FieldConfig } from "../types";

export const comparisonFields: FieldConfig[] = [
  { key: "title", type: "text", label: "標題", placeholder: "對比標題", required: true },
  { key: "columns", type: "columns", label: "對比欄位" },
];
