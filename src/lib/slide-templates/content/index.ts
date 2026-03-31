import type { TemplatePlugin } from "../types";
import { renderContent } from "./render";
import { contentStyles } from "./styles";
import { contentFields } from "./fields";

const contentPlugin: TemplatePlugin = {
  type: "content",
  label: "內容",
  icon: "📝",

  variants: [
    { id: "bullets", label: "列點" },
    { id: "numbered", label: "編號" },
    { id: "paragraph", label: "段落" },
  ],
  defaultVariant: "bullets",

  render: (slide, index, _total) => renderContent(slide, index),
  styles: contentStyles,
  fields: contentFields,

  promptDescription: "Default — general content with bullet points or paragraphs",
  contentFields: "title, body?, items[]?, footnote?",
};

export default contentPlugin;
