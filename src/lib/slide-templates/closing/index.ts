import type { TemplatePlugin } from "../types";
import { renderClosing } from "./render";
import { closingStyles } from "./styles";
import { closingFields } from "./fields";

const closingPlugin: TemplatePlugin = {
  type: "closing",
  label: "結尾",
  icon: "🎬",

  variants: [
    { id: "thank-you", label: "致謝" },
    { id: "cta", label: "行動號召" },
    { id: "summary", label: "摘要" },
  ],
  defaultVariant: "thank-you",

  render: (slide, index, _total) => renderClosing(slide, index),
  styles: closingStyles,
  fields: closingFields,

  promptDescription: "Last slide of the presentation",
  contentFields: "title, body?, footnote?",
};

export default closingPlugin;
