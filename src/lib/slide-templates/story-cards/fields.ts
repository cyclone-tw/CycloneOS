import type { FieldConfig } from "../types";

export const storyCardsFields: FieldConfig[] = [
  { key: "title", type: "text", label: "標題", placeholder: "卡片區標題", required: true },
  { key: "cards", type: "cards", label: "卡片" },
  { key: "footnote", type: "text", label: "註腳", placeholder: "底部說明文字" },
];
