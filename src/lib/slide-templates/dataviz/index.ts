import type { TemplatePlugin } from "../types";
import { renderDataviz } from "./render";
import { datavizStyles } from "./styles";
import { datavizFields } from "./fields";

const datavizPlugin: TemplatePlugin = {
  type: "dataviz",
  label: "數據",
  icon: "📊",

  variants: [
    { id: "horizontal-bars", label: "橫條圖" },
    { id: "big-number", label: "大數字" },
    { id: "stats-row", label: "統計列" },
    { id: "comparison", label: "比較" },
  ],
  defaultVariant: "horizontal-bars",

  render: (slide, index, _total) => renderDataviz(slide, index),
  styles: datavizStyles,
  fields: datavizFields,

  promptDescription: "Source contains concrete numbers, statistics, or data",
  contentFields: "title, items[]?, bigNumber{value,label}?, stats[]?, columns[]?, footnote?",
};

export default datavizPlugin;
