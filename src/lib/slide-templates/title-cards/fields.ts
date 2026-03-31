import type { FieldConfig } from "../types";

export const titleCardsFields: FieldConfig[] = [
  { key: "title", type: "text", label: "標題", placeholder: "標題卡片標題", required: true },
  { key: "bannerImage", type: "image", label: "橫幅圖片" },
  { key: "cards", type: "cards", label: "卡片" },
];
