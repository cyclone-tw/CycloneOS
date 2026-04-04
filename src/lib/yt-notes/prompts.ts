import type { VideoMeta } from "./types";

export function buildSummaryPrompt(meta: VideoMeta, transcript: string): string {
  return `你是一位專業的影片摘要分析師。請根據以下 YouTube 影片的逐字稿，產出一份結構化的詳細摘要。

## 影片資訊
- 標題：${meta.title}
- 頻道：${meta.channel}
- 長度：${meta.duration}
- 語言：${meta.language}

## 逐字稿
${transcript}

## 輸出要求

請用繁體中文產出以下結構的摘要（即使原文是英文）：

# ${meta.title}

## 核心概念
- 用 3-5 個重點 bullet points 總結影片最重要的概念

## 章節整理
- 按影片時間軸整理各段落主題，格式為 "MM:SS - 段落標題"，每段附 1-2 句說明

## 實作技巧 / 工具
- 列出影片提到的實用建議、工具、方法

## 關鍵術語
- **術語** — 解釋（列出影片中的專業術語）

## 值得深入的部分
- 列出值得進一步研究或學習的延伸主題

## 對你的啟發
- 從個人學習和應用的角度，提供 2-3 個行動建議

---

注意：
- 章節時間戳盡量對應逐字稿中的實際時間
- 摘要要詳細但精煉，不要逐句翻譯
- 保留原文的專有名詞（技術名詞可附英文）
- 產出的主題標籤（topics）請另外用 JSON 格式列在最後一行，格式：TOPICS_JSON:["主題1","主題2","主題3"]`;
}
