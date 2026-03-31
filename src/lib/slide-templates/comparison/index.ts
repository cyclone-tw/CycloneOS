import type { TemplatePlugin } from "../types";
import { renderComparison } from "./render";
import { comparisonStyles } from "./styles";
import { comparisonFields } from "./fields";

const comparisonPlugin: TemplatePlugin = {
  type: "comparison",
  label: "對比",
  icon: "⚖️",

  variants: [
    { id: "vs-split", label: "VS 對決" },
    { id: "before-after", label: "前後對照" },
    { id: "pros-cons", label: "優缺點" },
  ],
  defaultVariant: "vs-split",

  render: (slide, index, _total) => renderComparison(slide, index),
  styles: comparisonStyles,
  fields: comparisonFields,

  promptDescription: "Source explicitly compares good/bad, before/after, or pros/cons",
  contentFields: "title (required), columns[2] (each with title?, items[]?)",
};

export default comparisonPlugin;
