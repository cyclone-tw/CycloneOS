import type { FieldConfig } from "../types";

export const twoColumnFields: FieldConfig[] = [
  { key: "title", type: "text", label: "標題", placeholder: "比較標題", required: true },
  { key: "columns", type: "columns", label: "欄位內容" },
  { key: "footnote", type: "text", label: "註腳", placeholder: "底部說明文字" },
];
