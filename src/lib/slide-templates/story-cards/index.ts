import type { TemplatePlugin } from "../types";
import { renderStoryCards } from "./render";
import { storyCardsStyles } from "./styles";
import { storyCardsFields } from "./fields";

const storyCardsPlugin: TemplatePlugin = {
  type: "story-cards",
  label: "卡片",
  icon: "🃏",

  variants: [
    { id: "grid-3", label: "三欄" },
    { id: "grid-2", label: "雙欄" },
    { id: "single", label: "單張" },
  ],
  defaultVariant: "grid-3",

  render: (slide, index, _total) => renderStoryCards(slide, index),
  styles: storyCardsStyles,
  fields: storyCardsFields,

  promptDescription: "Source has 2-3 parallel concepts needing longer descriptions",
  contentFields: "title, cards[{title, body, icon?}], footnote?",
};

export default storyCardsPlugin;
