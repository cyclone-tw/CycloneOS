import type { FieldConfig } from "../types";

export const closingFields: FieldConfig[] = [
  { key: "title", type: "text", label: "標題", placeholder: "感謝文字", required: true },
  { key: "body", type: "textarea", label: "內文", placeholder: "結語或行動號召" },
  { key: "footnote", type: "text", label: "註腳", placeholder: "聯絡資訊或說明" },
];
