import type { TemplatePlugin } from "../types";
import { renderQuote } from "./render";
import { quoteStyles } from "./styles";
import { quoteFields } from "./fields";

const quotePlugin: TemplatePlugin = {
  type: "quote",
  label: "引言",
  icon: "💬",

  variants: [
    { id: "simple", label: "簡單" },
    { id: "card-overlay", label: "卡片" },
    { id: "fullscreen", label: "全螢幕" },
  ],
  defaultVariant: "simple",

  render: (slide, index, _total) => renderQuote(slide, index),
  styles: quoteStyles,
  fields: quoteFields,

  promptDescription: "Source contains a direct quote or citation",
  contentFields: "quote{text, author?, source?}, body?",
};

export default quotePlugin;
