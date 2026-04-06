// src/lib/social/prompts.ts
// Per-platform prompt templates for the Social Posting workstation.

export type Platform = "fb" | "ig" | "line" | "school" | "notion";
export type Tone = "knowledge" | "casual" | "promotion";

export const TONE_LABELS: Record<Tone, string> = {
  knowledge: "知識分享（專業、有深度、條理清晰）",
  casual: "輕鬆日常（口語、親切、貼近生活）",
  promotion: "活動宣傳（積極、吸引人、號召行動）",
};

export const PLATFORM_INSTRUCTIONS: Record<Platform, string> = {
  fb: `Facebook 貼文規範：
- 字數：500–800 字
- 段落短（2–4 句為一段），善用換行增加可讀性
- 開頭要有吸睛的 hook（一句話抓住注意力）
- 結尾要有 CTA（呼籲留言、分享或採取行動）
- 加入 3–5 個相關 hashtag（中英文皆可）`,

  ig: `Instagram 貼文規範：
- 字數：300–500 字
- 句子短，節奏輕快
- 適當使用 emoji 增加視覺感
- 結尾加入 10–15 個 hashtag（以換行隔開正文）`,

  line: `LINE 社群貼文規範：
- 字數：200 字以內
- 使用條列式呈現重點（每點前加「▸」或「・」）
- 不加 hashtag
- 語氣親切簡短，適合手機閱讀`,

  school: `學校公告規範：
- 使用正式公文語氣，稱呼用「本校」「各位家長」「敬請」等
- 文言助詞如「茲」「謹」可適當使用
- 不使用 emoji
- 不加 hashtag
- 結構清晰，包含事由、時間、地點、聯絡人`,

  notion: `Notion 文章規範：
- 輸出完整文章，字數不限
- 使用 Markdown 格式（標題用 ## ###，條列用 -，粗體用 **）
- 不加 hashtag
- 適合作為知識庫文章存檔`,
};

/**
 * Build a prompt for the LLM to generate social posts for multiple platforms.
 * The LLM should return a JSON object with one key per platform plus an
 * optional "hashtags" key containing a combined hashtag list.
 *
 * @param sourceText  The source content to base the posts on
 * @param platforms   Which platforms to generate for
 * @param tone        The writing tone to apply
 */
export function buildSocialPrompt(
  sourceText: string,
  platforms: Platform[],
  tone: Tone
): string {
  const toneInstruction = TONE_LABELS[tone];

  const platformSections = platforms
    .map((p) => {
      const key = p;
      return `=== ${key.toUpperCase()} ===\n${PLATFORM_INSTRUCTIONS[p]}`;
    })
    .join("\n\n");

  const platformKeys = platforms.map((p) => `"${p}"`).join(", ");

  return `你是台灣特教教師的社群貼文助理，請根據以下素材，為指定平台撰寫繁體中文貼文。

【語氣風格】
${toneInstruction}

【素材內容】
${sourceText}

【各平台撰寫規範】
${platformSections}

【輸出格式】
請直接回傳一個 JSON 物件（不要包在 markdown 程式碼區塊內），包含以下 key：
- ${platformKeys}（各平台貼文內容，字串）
- "hashtags"（所有平台共用的 hashtag 陣列，字串陣列，不含 # 符號）

範例格式：
{
  "fb": "貼文內容...",
  "ig": "貼文內容...",
  "hashtags": ["特教", "融合教育"]
}

請確保每個平台的內容都完全符合上述規範，並使用繁體中文。`;
}
