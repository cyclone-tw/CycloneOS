@AGENTS.md

## 🔜 Next Session: Felo 全面整合 — Deep Research + 生圖 + Web Fetch

> 複製以下內容作為新 session 的第一句話，然後刪除此區塊。

```
這是從 CycloneOpenClaw 分離出來的獨立 Dashboard repo（CycloneOS）。
上個 session（2026-03-30/31 #3 in CycloneOpenClaw）完成了大量工作，現在要繼續 Felo 整合。

## 已完成（在舊 repo，已複製過來）

### Slide Engine V3.5
- Template Plugin 系統：13 個版型各自獨立模組（render + styles + fields + index）
- 5 新版型：image-showcase, icon-grid, statement, comparison, title-cards
- AI 決策樹 prompt 取代平面表格
- FieldRenderer 通用欄位元件
- 逐頁「生成講稿」「生成圖片提示」按鈕
- 全面字體縮放修正（所有 13 模板的 titleScale/subtitleScale/bodyScale/cardScale）
- 內文預設靠左對齊修正

### 來源擴充
- SourceItem 已擴充：type 新增 "text" | "research"，新增 textContent/researchQuery 欄位
- 貼上文字功能 ✅ 已實作並測試可用
- Deep Research route ✅ 已建立 /api/presentations/research（Felo Chat API + Claude 合成）
- 匯入 OpenClaw 研究 ✅ source panel 可瀏覽 Obsidian vault Draco/research/
- generate route 已改接受 SourceItem[]（textContent 直接用，不讀檔）

## 已確定的設計決策

### Felo 整合架構
- **方案 B+**：全域共用一個 LiveDoc，存 ID 到 localStorage，跨 session 共用
- LiveDoc 數量無限制，使用量走 Felo 訂閱制點數
- 圖片策略：顯示 URL 同時下載到本地 `public/uploads/`

### Felo API 能力（已讀完 OpenClaw skills 文件）
- **felo-search**：`POST /v2/chat` — 即時搜尋 + AI 摘要（已用在 research route）
- **felo-superAgent**：SSE 串流對話 + 工具呼叫（generate_images, generate_ppt, generate_discovery 等）
  - skill-id: twitter-writer, logo-and-branding, ecommerce-product-image
  - 需要 LiveDoc ID
  - 腳本：`run_superagent.mjs`（OpenClaw 的，需移植到 Dashboard lib）
- **felo-web-fetch**：`POST /v2/web/extract` — URL 轉 html/markdown/text
- **felo-livedoc**：LiveDoc CRUD（list/create/delete）
  - 腳本：`run_livedoc.mjs`

### 要做的功能（4 個）

1. **lib/felo/** — Felo client library
   - 從 OpenClaw skills 移植核心 API 呼叫邏輯（不需要完整腳本，只要 API client）
   - felo-search.ts, felo-superagent.ts, felo-web-fetch.ts, felo-livedoc.ts
   - 共用 FELO_API_KEY 從 env

2. **強化 /api/presentations/research** — 改用 lib/felo/
   - 現有版本直接 fetch Felo API，改成用 felo client lib

3. **生圖功能** — slide editor 加「AI 生圖」
   - 觸發：在 slide editor 按鈕（在「生成圖片提示」旁邊）
   - 流程：imagePrompt → SuperAgent generate_images → 下載圖片 → 設為 slide 背景/image
   - 需要 LiveDoc 管理（建立/取得）
   - 新增 /api/presentations/generate-image route

4. **Web Fetch 來源** — source panel 加「從 URL 擷取」
   - 使用者貼 URL → felo-web-fetch 擷取內容 → 轉成 markdown → 加入來源
   - SourceItem type: "url"
   - 新增 /api/presentations/fetch-url route

### OpenClaw Felo Skills 文件位置（參考用）
- Obsidian: Draco/01.OpenClaw/OpenClaw-skills/felo-search.md
- Obsidian: Draco/01.OpenClaw/OpenClaw-skills/felo-superAgent.md
- Obsidian: Draco/01.OpenClaw/OpenClaw-skills/felo-web-fetch.md
- Obsidian: Draco/01.OpenClaw/OpenClaw-skills/felo-livedoc.md

### 環境變數
- FELO_API_KEY 已在 .env.local（需確認是否已設定）

## 相關檔案
- src/app/api/presentations/research/route.ts — 現有 research route
- src/app/api/presentations/refine/route.ts — per-slide generation（講稿/圖片提示）
- src/components/skills/workstations/presentations/presentations-source-panel.tsx — 來源面板
- src/components/skills/workstations/presentations/slide-layout-editor.tsx — slide 編輯器
- src/lib/llm-provider.ts — LLM 呼叫
- src/stores/presentations-store.ts — 簡報 store
- src/stores/documents-store.ts — SourceItem type

先 brainstorm 確認生圖 UI 流程 → write-plan → 分批實作 4 個功能。
```
