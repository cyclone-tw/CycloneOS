import type { TemplatePlugin } from "../types";
import { renderTitleCards } from "./render";
import { titleCardsStyles } from "./styles";
import { titleCardsFields } from "./fields";

const titleCardsPlugin: TemplatePlugin = {
  type: "title-cards",
  label: "標題卡片",
  icon: "🏷️",

  variants: [
    { id: "banner-2", label: "二卡" },
    { id: "banner-3", label: "三卡" },
    { id: "banner-4", label: "四卡" },
  ],
  defaultVariant: "banner-3",

  render: (slide, index, _total) => renderTitleCards(slide, index),
  styles: titleCardsStyles,
  fields: titleCardsFields,

  promptDescription: "Source has multiple sub-topics each with a representative image",
  contentFields: "title (required), bannerImage? ({url, fit?}), cards[] ({title, body?, imageUrl?})",
};

export default titleCardsPlugin;
