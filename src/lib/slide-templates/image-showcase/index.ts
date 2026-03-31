import type { TemplatePlugin } from "../types";
import { renderImageShowcase } from "./render";
import { imageShowcaseStyles } from "./styles";
import { imageShowcaseFields } from "./fields";

const imageShowcasePlugin: TemplatePlugin = {
  type: "image-showcase",
  label: "圖片展示",
  icon: "🖼️",

  variants: [
    { id: "single", label: "單張" },
    { id: "duo", label: "雙張" },
    { id: "trio", label: "三張" },
    { id: "quad", label: "四張" },
  ],
  defaultVariant: "single",

  render: (slide, index, _total) => renderImageShowcase(slide, index),
  styles: imageShowcaseStyles,
  fields: imageShowcaseFields,

  promptDescription: "Source needs to show screenshots, UI, or diagrams",
  contentFields: "title (required), subtitle?, images[] ({url, caption?, fit?}), footnote?",
};

export default imageShowcasePlugin;
