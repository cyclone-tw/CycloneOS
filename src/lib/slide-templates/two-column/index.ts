import type { TemplatePlugin } from "../types";
import { renderTwoColumn } from "./render";
import { twoColumnStyles } from "./styles";
import { twoColumnFields } from "./fields";

const twoColumnPlugin: TemplatePlugin = {
  type: "two-column",
  label: "雙欄",
  icon: "⬜⬜",

  variants: [
    { id: "text-text", label: "文字-文字" },
    { id: "text-image", label: "文字-圖片" },
    { id: "text-list", label: "文字-清單" },
  ],
  defaultVariant: "text-text",

  render: (slide, index, _total) => renderTwoColumn(slide, index),
  styles: twoColumnStyles,
  fields: twoColumnFields,

  promptDescription: "Source puts two concepts side by side (not good/bad comparison)",
  contentFields: "title, columns[{title?, items[]?, body?}], footnote?",
};

export default twoColumnPlugin;
