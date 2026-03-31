import type { FieldConfig } from "../types";

export const statementFields: FieldConfig[] = [
  { key: "title", type: "textarea", label: "宣言文字", placeholder: "每行一句主張", required: true },
  { key: "body", type: "text", label: "補充說明", placeholder: "署名或補充文字" },
  { key: "highlightLines", type: "highlight-lines", label: "強調行" },
];
