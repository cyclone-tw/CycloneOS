---
name: social-posting
description: "社群多平台發文工作流：5 平台（FB/IG/LINE/學校/Notion）、3 種語氣、圖片上傳、Notion 草稿儲存。操作 Social 工作站時自動載入。"
user-invocable: false
---

# 社群多平台發文工作流

CycloneOS Social 工作站的完整發文流程。

---

## 支援平台與規格

| 平台 | 字數 | 特色 |
|------|------|------|
| **FB** | 500-800 字 | Hook 開頭 + CTA + 3-5 hashtags |
| **IG** | 300-500 字 | Emoji 友善 + 10-15 hashtags |
| **LINE** | ≤200 字 | 條列式、無 hashtags |
| **學校公告** | 無限制 | 正式語氣、官方中文慣例 |
| **Notion** | 無限制 | 完整 Markdown 文章 |

## 語氣選項

- `knowledge` — 知識分享型
- `casual` — 輕鬆對話型
- `promotion` — 推廣宣傳型

---

## 工作流

```
素材輸入 → 選平台 + 語氣 → AI 生成 → 預覽/編輯 → 存 Notion 草稿 → 手動發佈
```

### Step 1：輸入素材
- 文字素材（sourceText）
- 圖片上傳（POST `/api/social/upload-image`，支援 JPEG/PNG/GIF/WebP，≤10MB）
- 圖片存到 `public/uploads/social/YYYY-MM-DD/`

### Step 2：AI 生成
- POST `/api/social/generate`
- 用 `buildSocialPrompt()` 根據平台規格 + 語氣建 prompt
- SSE streaming 回傳各平台內容
- 輸出為 JSON：每個平台一個 content 欄位

### Step 3：發佈到 Notion（草稿）
- POST `/api/social/publish-notion`
- 呼叫 `createSocialPost()` → Notion API
- 建立頁面包含：標題、狀態（草稿）、平台、發佈日期、各平台內容、圖片 URL
- 回傳 `{ notionUrl, pageId }`

### Step 4：手動發佈
- 從 Notion 複製各平台內容，貼到對應社群平台
- （未來可考慮 API 自動發佈）

---

## 關鍵檔案

| 檔案 | 用途 |
|------|------|
| `src/app/api/social/generate/route.ts` | AI 生成（SSE stream）|
| `src/app/api/social/publish-notion/route.ts` | 存 Notion 草稿 |
| `src/app/api/social/history/route.ts` | 歷史記錄 |
| `src/app/api/social/upload-image/route.ts` | 圖片上傳 |
| `src/lib/social/prompts.ts` | 平台規格 + 語氣指令 |
| `src/lib/social/notion.ts` | Notion API 整合 |
| `src/stores/social-store.ts` | Zustand 狀態管理 |

---

## Notion 資料庫

- 環境變數：`NOTION_SOCIAL_DATABASE_ID`
- Properties：Title, Status, Platforms, Publish Date, Tags, Tone, Source, Hashtags, Content FB/IG/LINE/School, Image URLs

---

## 修改注意

- 新增平台 → 改 `prompts.ts` 的平台規格 + `notion.ts` 的 properties
- 修改語氣 → 改 `prompts.ts` 的 tone instructions
- 修改 Notion 欄位 → 改 `notion.ts` 的 `createSocialPost()`
- 自動發佈 → 需新增各平台 API 整合到 `src/lib/social/`
