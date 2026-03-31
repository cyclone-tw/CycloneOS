import type { FieldConfig } from "../types";

export const coverFields: FieldConfig[] = [
  { key: "title", type: "text", label: "標題", placeholder: "簡報標題", required: true },
  { key: "subtitle", type: "text", label: "副標題", placeholder: "副標題文字" },
  { key: "badge", type: "text", label: "標籤", placeholder: "例：2026 年度報告" },
  { key: "footnote", type: "text", label: "註腳", placeholder: "底部說明文字" },
];
