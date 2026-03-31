import type { TemplatePlugin } from "../types";
import { renderCover } from "./render";
import { coverStyles } from "./styles";
import { coverFields } from "./fields";

const coverPlugin: TemplatePlugin = {
  type: "cover",
  label: "封面",
  icon: "🎯",

  variants: [
    { id: "gradient", label: "漸層" },
    { id: "image-bg", label: "背景圖" },
    { id: "clean", label: "簡潔" },
  ],
  defaultVariant: "gradient",

  render: (slide, index, _total) => renderCover(slide, index),
  styles: coverStyles,
  fields: coverFields,

  promptDescription: "First slide of the presentation",
  contentFields: "title, subtitle?, badge?, footnote?",
};

export default coverPlugin;
