import type { FieldConfig } from "../types";

export const contentFields: FieldConfig[] = [
  { key: "title", type: "text", label: "標題", placeholder: "內容標題", required: true },
  { key: "body", type: "textarea", label: "內文", placeholder: "段落文字" },
  { key: "items", type: "items", label: "列表項目" },
  { key: "footnote", type: "text", label: "註腳", placeholder: "底部說明文字" },
];
