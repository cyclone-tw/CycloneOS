import type { FieldConfig } from "../types";

export const imageShowcaseFields: FieldConfig[] = [
  { key: "title", type: "text", label: "標題", placeholder: "圖片展示標題", required: true },
  { key: "subtitle", type: "text", label: "副標題", placeholder: "選填副標題" },
  { key: "images", type: "images", label: "圖片" },
  { key: "footnote", type: "text", label: "註腳", placeholder: "底部說明文字" },
];
