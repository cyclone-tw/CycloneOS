@AGENTS.md

## 最高原則：AI Agent 無關性 (MANDATORY)

CycloneOS 的所有程式碼、架構、介面設計，**必須確保任何 AI Agent 都能快速接手**，不得與特定 AI 綁死。

### 規則

1. **LLM 呼叫一律走抽象層** — 所有 AI 呼叫透過 `src/lib/llm-provider.ts` 或同等抽象介面，不直接 import 特定 SDK（如 `@anthropic-ai/sdk`）到業務邏輯中
2. **Prompt 與邏輯分離** — Prompt 模板存放在可獨立替換的位置，不寫死在元件或 route 裡。新 agent 接手時只需替換 prompt，不需改業務邏輯
3. **工具定義標準化** — 工具呼叫（tool use）遵循通用格式（function name + parameters + result），不依賴特定 AI 的 tool schema 語法
4. **外部 API 獨立封裝** — 如 Felo、Google、Notion 等第三方 API，封裝在獨立的 `lib/` 模組中，與 AI 層完全解耦
5. **Context 格式可攜** — Session、對話歷史、文件 context 使用標準格式（JSON/Markdown），任何 agent 都能讀取
6. **不使用 AI 專屬特性** — 避免使用只有特定 AI 才有的功能（如 Claude 的 `stdinPrompt`），除非有明確的 fallback 路徑

### 檢查清單（每次 PR 前確認）

- [ ] 新增的 AI 呼叫是否走抽象層？
- [ ] 能否用一句話描述如何切換到另一個 AI provider？
- [ ] Prompt 是否能獨立替換而不影響程式邏輯？

---

## 🔜 Next Session: Felo 收尾 + UI 改善 + Computer Use Phase 1

> 複製以下內容作為新 session 的第一句話，然後刪除此區塊。

```
這是 CycloneOS 獨立 Dashboard repo。上個 session（2026-04-02 #1）完成了 Felo 全面整合。

## 已完成

### Felo AI 工作站
- lib/felo/ API client（search, superagent, web-fetch, livedoc）
- Felo Workstation skill 卡片（混合式：對話 + 快捷入口 + 產出面板）
- SuperAgent SSE 雙重 JSON 解碼 + 自動重連 + LiveDoc image polling
- 對話匯出按鈕（MD/DOCX/XLSX + 自訂指令由 Claude Code 處理）
- felo-output-store（Zustand + localStorage persist）

### Presentations 增強
- 串接式生圖 UI（生成圖片提示 → 編輯 → 用此提示生圖）
- URL 智慧偵測（source panel 貼 URL 自動提示擷取）
- research route 改用 lib/felo/search
- push-github 改用 cyclone-tw/slides repo

### Documents 工作站
- 實作 DOCX、PDF（print HTML）、XLSX 輸出
- 移除 HTML 簡報和 PPTX 選項

### 系統架構
- paths-config.ts 統一管理所有輸出路徑
- MD 統一存 Obsidian（CycloneOS/outputs/），二進位存 Google Drive
- 檔名規則：YYYY-MM-DD-{source}-{summary}.{ext}
- AI Agent 無關性原則寫入 CLAUDE.md
- IME 注音輸入法相容

### 設計文件
- Felo 整合 spec：docs/superpowers/specs/2026-03-31-felo-integration-design.md
- Computer Use spec：docs/superpowers/specs/2026-03-31-computer-use-design.md

## 待辦事項（按優先順序）

### 1. Felo 收尾
- Felo chat 訊息用 react-markdown 渲染（目前是純 whitespace-pre-wrap）
- 進度訊息改善（`_處理中..._` 用 spinner 或灰色小字取代斜體）
- paths-config.ts 清理殘留的 webFetch 路徑定義（已不使用）
- 測試 Felo 匯出的 DOCX/XLSX 實際檔案品質

### 2. 簡報工作站 UI
- push-github 前端加 folderName 輸入框（後端已支援，前端還沒有）
- 簡報 push 後顯示 GitHub Pages URL

### 3. Computer Use Phase 1（設計文件已寫好）
- 建立 cycloneos-agent/ 獨立 Node.js 專案
- 實作截圖模組（screencapture / screenshot-desktop）
- 實作滑鼠鍵盤控制（@nut-tree/nut-js）
- 實作 Claude API 橋接（computer-use-2025-01-24 tool）
- WebSocket server 與 CycloneOS 通訊
- 先做 CLI 版本，能在終端機直接操控

### 4. 全域改善
- 全域 toast/notification 系統（取代各元件的 alert）
- 統一錯誤處理 middleware

## 相關檔案
- src/config/paths-config.ts — 統一路徑管理
- src/lib/felo/ — Felo API client
- src/app/api/felo/chat/route.ts — Felo SSE chat（最複雜的 route）
- src/components/skills/workstations/felo/ — Felo Workstation UI
- src/lib/document-converters.ts — DOCX/PDF/XLSX 轉換器
- docs/superpowers/specs/2026-03-31-computer-use-design.md — Computer Use 架構

先從待辦 1（Felo 收尾）開始，快速修完 UI 問題後進入 Computer Use。
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
