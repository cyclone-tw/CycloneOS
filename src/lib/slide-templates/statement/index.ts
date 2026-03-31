import type { TemplatePlugin } from "../types";
import { renderStatement } from "./render";
import { statementStyles } from "./styles";
import { statementFields } from "./fields";

const statementPlugin: TemplatePlugin = {
  type: "statement",
  label: "宣言",
  icon: "💪",

  variants: [
    { id: "centered", label: "置中" },
    { id: "left-bold", label: "左對齊" },
    { id: "highlight", label: "螢光標記" },
  ],
  defaultVariant: "centered",

  render: (slide, index, _total) => renderStatement(slide, index),
  styles: statementStyles,
  fields: statementFields,

  promptDescription: "Source has one core claim/assertion with NO list of items",
  contentFields: "title (required, multi-line statement text), body? (attribution), highlightLines? (line indices for accent)",
};

export default statementPlugin;
