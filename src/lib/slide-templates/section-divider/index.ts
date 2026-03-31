import type { TemplatePlugin } from "../types";
import { renderSectionDivider } from "./render";
import { sectionDividerStyles } from "./styles";
import { sectionDividerFields } from "./fields";

const sectionDividerPlugin: TemplatePlugin = {
  type: "section-divider",
  label: "分隔頁",
  icon: "📌",

  variants: [
    { id: "dark", label: "深色" },
    { id: "accent", label: "強調色" },
  ],
  defaultVariant: "dark",

  render: (slide, index, _total) => renderSectionDivider(slide, index),
  styles: sectionDividerStyles,
  fields: sectionDividerFields,

  promptDescription: "Section break between major topics",
  contentFields: "title, subtitle?",
};

export default sectionDividerPlugin;
