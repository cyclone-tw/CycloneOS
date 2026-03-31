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

---

## Handoff Prompt Protocol (MANDATORY)

當使用者要求結束 session 並提供下一次工作的 handoff prompt 時：

1. **同時在對話中輸出 prompt** — 讓使用者可以直接複製貼上
2. **寫入 CLAUDE.md 的 `🔜 Next Session` 區塊** — 讓新 session 的 Claude 也能看到

`🔜 Next Session` 區塊格式：
```markdown
## 🔜 Next Session: <簡短標題>

> 複製以下內容作為新 session 的第一句話，然後刪除此區塊。

\`\`\`
<handoff prompt 內容>
\`\`\`
```

**Rules:**
- 新 session 開始執行後，**必須刪除此區塊**
- 如果已有舊的 `🔜 Next Session` 區塊，直接覆蓋
- prompt 要包含足夠 context 讓新 session 不需要回頭翻 session log

## Commit Protocol (MANDATORY — NO CONFIRMATION NEEDED)

When the user says "commit" (or any variation like `/commit`、「commit 一下」), you MUST automatically execute **both** steps below **without asking for confirmation**:

1. **Git commit** — stage relevant changes and commit with a descriptive message
2. **CHANGELOG** — 更新 CHANGELOG.md（如果本次 commit 包含重要里程碑或功能）

Execute these in order. Do not ask "要不要更新 CHANGELOG？" or similar — 自行判斷是否為里程碑級變更。

## CHANGELOG Protocol (MANDATORY)

本 repo 使用累積式 CHANGELOG 取代 per-topic dev log。

**檔案位置：** `CHANGELOG.md`（git tracked）

**格式：**
```markdown
# CycloneOS Changelog

## YYYY-MM-DD
- 一行描述一個重要變更或里程碑

## YYYY-MM-DD
- ...
```

**Rules:**
- 最新日期在最上面
- 每行以 `- ` 開頭，一句話描述
- Use Traditional Chinese
- 同一天的變更合併在同一個日期區塊

## Session Log Protocol (MANDATORY)

When the user says "重開 session"、"新 session"、"restart session"、"結束這個 session" or any similar variation, you MUST generate a session log **before** ending the conversation.

### 寫入位置

```
${VAULT}/CycloneOS/sessions/
```

**VAULT 路徑：**
```
~/Library/CloudStorage/GoogleDrive-user@gmail.com/我的雲端硬碟/Obsidian-Cyclone
```

### Filename format

`YYYY-MM-DD-session-<sequential-number>.md`

### Session Log Template

```markdown
---
type: session-log
date: YYYY-MM-DD
session: <number>
source: cycloneos
session-type: dev | work
tags: [cycloneos, <相關標籤>]
outputs: [<產出檔案路徑列表>]
knowledge-gained: [<新學到的關鍵知識>]
---

# YYYY-MM-DD Session <number>

## 目標
- （進入 session 時要做什麼）

## 過程摘要
- （按時間順序，重要的討論點和決策）

## 產出清單
- （具體產出的檔案，含完整路徑）

## 決策與判斷
- （為什麼選這個方向、放棄了什麼、取捨原因）

## 知識累積
- （這次 session 學到的新東西）

## 變更清單
- （列出所有被新增/修改/刪除的檔案或設定）

## 待辦 / 下次接續
- （未完成的事項、下個 session 可以接著做的）

## 系統改善建議
- （使用過程中發現 CycloneOS 可以優化的地方）
```

### Session Type 判斷

- **`dev`**：改 CycloneOS 系統本身 — dashboard、腳本、設定、設計文件
- **`work`**：用 CycloneOS 做事 — 簡報、會議紀錄、公文分析、教材、研究

### Rules
- Use Traditional Chinese
- 記錄所有**重要討論與判斷**，不只是程式碼變更
- `決策與判斷` 和 `知識累積` 是最重要的兩個區塊
- 寫完後告知使用者檔案位置，然後才結束 session
