import type { FieldConfig } from "../types";

export const datavizFields: FieldConfig[] = [
  { key: "title", type: "text", label: "標題", placeholder: "數據標題", required: true },
  { key: "items", type: "items", label: "數據項目" },
  { key: "bigNumber", type: "text", label: "大數字", placeholder: "例：95%" },
  { key: "stats", type: "items", label: "統計列" },
  { key: "columns", type: "columns", label: "比較欄位" },
  { key: "footnote", type: "text", label: "註腳", placeholder: "資料來源" },
];
