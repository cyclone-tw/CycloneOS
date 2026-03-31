import type { TemplatePlugin } from "../types";
import { renderIconGrid } from "./render";
import { iconGridStyles } from "./styles";
import { iconGridFields } from "./fields";

const iconGridPlugin: TemplatePlugin = {
  type: "icon-grid",
  label: "圖標格",
  icon: "⚡",

  variants: [
    { id: "grid-3", label: "三格" },
    { id: "grid-4", label: "四格" },
    { id: "grid-6", label: "六格" },
  ],
  defaultVariant: "grid-3",

  render: (slide, index, _total) => renderIconGrid(slide, index),
  styles: iconGridStyles,
  fields: iconGridFields,

  promptDescription: "Source has 3-6 features/steps, each needing only one sentence",
  contentFields: "title (required), cards[] ({title, body, icon?}), footnote?",
};

export default iconGridPlugin;
