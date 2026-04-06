# 社群發文模組設計文件

> **方案：** 智慧轉發器（Smart Reposter）
> **日期：** 2026-04-06
> **狀態：** 設計完成，待實作

## 概述

CycloneOS Dashboard 的社群發文模組，讓特教教師能快速將知識素材轉化為多平台社群貼文。以 Notion Database 作為內容中樞，未來可串接 n8n 實現半自動化發布。

### 核心流程

```
素材輸入（Obsidian/直接輸入/圖片）
    ↓
平台選擇 + 語氣設定
    ↓
LLM 改寫（各平台適配版本）
    ↓
預覽 + 微調
    ↓
輸出：複製文字 / 發布到 Notion
    ↓
Notion Database（內容中樞）
    ↓
n8n 半自動分發（未來）
```

### 雙入口架構

```
┌─────────────────┐     ┌──────────────┐
│ CycloneOS       │     │ Discord Bot  │
│ Dashboard UI    │     │ (Claude Code)│
└────────┬────────┘     └──────┬───────┘
         └──────────┬──────────┘
                    ↓
            共用 API / 核心邏輯
                    ↓
         QMD ← Obsidian Vault
                    ↓
              LLM 加工
                    ↓
         Notion Database（中樞）
                    ↓
         n8n 分發（未來）
```

---

## 目標平台與輸出方式

| 平台 | 輸出方式 | AI 文字風格 |
|------|---------|------------|
| Facebook | 複製貼上（MVP）→ n8n 自動發（未來） | 500-800字、段落短、hook 開頭、CTA 結尾 |
| Instagram | 複製貼上（MVP）→ n8n 自動發（未來） | 2200字內、短句 + emoji、hashtag |
| LINE | 複製貼上（MVP）→ n8n 自動發（未來） | 精簡 200 字內、重點條列 |
| 學校網站 | 複製貼上 | 正式公文語氣 |
| Notion | 直接寫入 page body，可分享連結 | 完整文章格式、Notion 原生排版 |

---

## Notion Database Schema（n8n-friendly）

每個平台的內容存在獨立 property，讓 n8n 能直接以 `{{Notion.Content FB}}` 取值。

| 欄位 | 類型 | 用途 | n8n 用途 |
|------|------|------|----------|
| Title | title | 貼文主題 | — |
| Status | status | 草稿 → 待發布 → 已發布 → 失敗 | **觸發點** |
| Platforms | multi_select | 目標平台（FB/IG/LINE/學校網站/Notion） | 判斷發到哪 |
| Published | multi_select | 已成功發布的平台 | n8n 回寫 |
| Publish Date | date | 預計/實際發布日期 | n8n 排程 |
| Tags | multi_select | 內容分類（特教宣導/IEP技巧/活動紀錄...） | — |
| Tone | select | 知識分享 / 日常 / 活動宣傳 | — |
| Source | url | Obsidian 來源筆記路徑 | — |
| Content FB | rich_text | FB 版本純文字 | n8n 直接抓 |
| Content IG | rich_text | IG 版本純文字 | n8n 直接抓 |
| Content LINE | rich_text | LINE 版本純文字 | n8n 直接抓 |
| Content School | rich_text | 學校網站版本 | n8n 直接抓 |
| Hashtags | rich_text | hashtag 統一欄 | n8n 按平台附加 |
| Image URLs | rich_text | 圖片公開 URL（逗號分隔） | n8n 抓圖 |
| Error Log | rich_text | 發布失敗原因 | n8n 回寫 |
| Page Body | — | Notion 文章版本（完整排版） | 直接分享用 |

### Database Views

| View 名稱 | Filter | 用途 |
|-----------|--------|------|
| 所有貼文 | 無 | 總覽 |
| 待發布 | Status = 待發布 | 工作佇列 |
| Notion 文章 | Platforms contains "Notion" | 對外分享，可直接給連結 |
| FB 已發布 | Platforms contains "FB" & Status = 已發布 | 歸檔 |

---

## UI 結構

沿用現有工作站 pattern（左右分欄 + header）。

```
┌──────────────────────────────────────────────────────┐
│ ← Skills  📱 社群發文模組           [LLM 選擇]       │
├───────────────────┬──────────────────────────────────┤
│                   │                                  │
│  素材輸入面板       │  輸出預覽面板                     │
│                   │                                  │
│  ┌─ 文字來源 ──┐   │  ┌─ FB ─┬─ IG ─┬─ LINE ─┬...┐ │
│  │ ○ QMD 搜尋  │   │  ├──────┴──────┴────────┴───┤ │
│  │ ○ 直接輸入  │   │  │                          │ │
│  └────────────┘   │  │  [AI 生成的文字預覽]        │ │
│                   │  │                          │ │
│  ┌─ 文字內容 ──┐   │  ├──────────────────────────┤ │
│  │             │   │  │  📷 📷  (附圖縮圖)        │ │
│  │  (textarea  │   │  ├──────────────────────────┤ │
│  │   或搜尋結果)│   │  │  [📋 複製] [Notion 發布]  │ │
│  │             │   │  └──────────────────────────┘ │
│  └────────────┘   │                                │
│                   │  ┌─ 歷史記錄 ───────────┐      │
│  ┌─ 圖片 ─────┐   │  │ 04/05 情緒卡教材 FB ✓│      │
│  │ 📷 📷  +   │   │  │ 04/03 IEP小技巧  FB ✓│     │
│  └────────────┘   │  └─────────────────────┘      │
│                   │                                │
│  ┌─ 設定 ─────┐   │                                │
│  │ ☑FB ☑IG    │   │                                │
│  │ ☑Notion    │   │                                │
│  │ ☐LINE ☐學校│   │                                │
│  │ 語氣: 知識  │   │                                │
│  │ [✨ 生成]   │   │                                │
│  └────────────┘   │                                │
├───────────────────┴──────────────────────────────────┤
```

### 元件清單

| 元件 | 職責 |
|------|------|
| `SocialWorkstation` | 主容器，左右分欄，resizable |
| `SourceInput` | 文字來源切換（QMD 搜尋 / 直接輸入） |
| `ImageUploader` | 圖片拖曳上傳，顯示縮圖 |
| `PlatformSelector` | 平台勾選 + 語氣選擇 + 生成按鈕 |
| `PlatformPreview` | 分頁預覽各平台版本，含複製/發布按鈕 |
| `PostHistory` | 從 Notion 拉歷史記錄列表 |

---

## API Routes

```
POST /api/social/generate
  Body: { text: string, tone: string, platforms: string[] }
  Response: { fb?: string, ig?: string, line?: string, school?: string, notion?: string, hashtags: string }
  說明: LLM 根據素材 + 語氣生成各平台版本

POST /api/social/publish-notion
  Body: {
    title: string,
    platforms: string[],
    contents: { fb?, ig?, line?, school?, notion? },
    hashtags: string,
    imageUrls: string[],
    publishDate?: string,
    tags?: string[],
    tone?: string,
    source?: string
  }
  Response: { notionUrl: string, pageId: string }
  說明: 建立 Notion page，填入所有 property + page body，Status = 草稿

GET /api/social/history
  Response: { posts: Array<{ id, title, platforms, status, date, notionUrl }> }
  說明: 從 Notion Database 拉最近發文記錄

POST /api/social/upload-image
  Body: FormData (image files)
  Response: { urls: string[] }
  說明: 圖片存到 public/uploads/social/YYYY-MM-DD/，回傳 URL
```

---

## 圖片策略

### MVP

```
Dashboard 上傳 → public/uploads/social/YYYY-MM-DD/xxx.jpg
              → URL: http://localhost:3000/uploads/social/...
              → 寫入 Notion Image URLs 欄位
```

### 未來（串 Cloudflare R2）

```
Dashboard 上傳 → Cloudflare R2 bucket
              → URL: https://r2.your-domain/social/...
              → 寫入 Notion Image URLs 欄位
              → n8n 從公開 URL 抓圖分發
```

Cloudflare R2 免費額度：10GB 儲存 + 100 萬次上傳 + 1000 萬次讀取 + 零出口流量費，社群發文場景綽綽有餘。

---

## 檔案結構

```
src/
├── components/skills/workstations/social/
│   ├── social-workstation.tsx
│   ├── source-input.tsx
│   ├── image-uploader.tsx
│   ├── platform-selector.tsx
│   ├── platform-preview.tsx
│   └── post-history.tsx
├── app/api/social/
│   ├── generate/route.ts
│   ├── publish-notion/route.ts
│   ├── history/route.ts
│   └── upload-image/route.ts
├── lib/social/
│   ├── notion.ts                # Notion API（共用 markdownToBlocks）
│   └── prompts.ts               # 各平台 prompt 模板
└── stores/
    └── social-store.ts
```

---

## 既有資源複用

| 資源 | 位置 | 複用方式 |
|------|------|---------|
| `markdownToBlocks()` | `src/lib/yt-notes/notion.ts` | 抽到 `src/lib/notion-utils.ts` 共用，擴展支援粗體/斜體/編號 |
| `NOTION_API_KEY` | `.env.local` | 直接使用 |
| LLM 抽象層 | `src/lib/llm-provider.ts` | 生成路由使用 |
| `WorkstationLLMControls` | `src/components/skills/workstations/shared/` | Header 共用 |
| QMD MCP | 已接入 | SourceInput 的搜尋功能透過 API 呼叫 QMD |
| skills-config.ts | `social` 已定義 | 更新 description 和 tags |

---

## n8n 整合規劃（非 MVP，未來）

CycloneOS 端不需要額外修改，n8n 獨立設定：

```
n8n Workflow:
  Trigger: Notion Database — Status 變為「待發布」
     ↓
  Read: 讀取 Platforms、Content XX、Image URLs
     ↓
  Switch: 依 Platforms 分流
     ├── FB → Facebook Graph API 發文（附圖）
     ├── IG → Instagram Graph API 發文（附圖）
     ├── LINE → LINE Messaging API 推送
     └── 學校網站 → TBD
     ↓
  Success: 回寫 Published + Status = 已發布
  Failure: 回寫 Error Log + Status = 失敗
```

---

## MVP 不做

| 項目 | 原因 |
|------|------|
| 上傳 .md/.docx 檔案解析 | QMD + 直接貼文字已覆蓋 |
| Cloudflare R2 | 先用本地存圖 |
| n8n 串接 | CycloneOS 端已 ready，n8n 獨立設定 |
| 各平台 API 自動發文 | 等 n8n |
| Discord bot 指令 | API 已共用，之後加 command |
| 排程 UI / 內容日曆 | Notion 有 Publish Date 欄位即可 |
| AI Vision 看圖寫文 | 不需要 |
