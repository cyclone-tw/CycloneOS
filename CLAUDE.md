@AGENTS.md

## 最高原則：AI Agent 無關性 (MANDATORY)

CycloneOS 的所有程式碼、架構、介面設計，**必須確保任何 AI Agent 都能快速接手**，不得與特定 AI 綁死。

1. **LLM 呼叫一律走抽象層** — 透過 `src/lib/llm-provider.ts`，不直接 import 特定 SDK
2. **Prompt 與邏輯分離** — Prompt 模板可獨立替換，不寫死在元件或 route 裡
3. **外部 API 獨立封裝** — Felo、Google、Notion 等封裝在 `lib/` 模組中，與 AI 層解耦
4. **Context 格式可攜** — Session、對話歷史使用標準 JSON/Markdown 格式

---

## Commit Protocol

When the user says "commit"（或 `/commit`、「commit 一下」），自動執行：
1. Git commit — stage + commit with descriptive message
2. 自行判斷是否為里程碑級變更，如果是則執行 `/changelog` 更新 CHANGELOG

---

## Session 管理

- 結束 session 時執行 `/session-log`
- 需要 handoff 時執行 `/handoff`

---

## QMD 記憶系統

已連接 QMD（本機語意搜尋），可搜尋 Obsidian Vault。

**工具：** `qmd_search`（快搜）→ `qmd_deep_search`（深搜）→ `qmd_get`（取全文）

使用者問到歷史紀錄、筆記、個人偏好時，**主動用 QMD 搜尋**，回答時註明來源。

---

## 🔜 Next Session: 特推會備會擴展 + 學生資料 Spec + IEP 面板

> 複製以下內容作為新 session 的第一句話，然後刪除此區塊。

```
接續 session-06（2026-04-05，Mac Mini）。教育工作站 Phase 1 已完成並合併 main。

## 已完成（session-06）

教育工作站入口頁 + 特推會會議記錄完整面板：
- 入口頁：4 個子模組卡片（特推會可用，其餘即將推出）
- 特推會 4-step 流程：基本資訊→前次決議+業務報告→提案討論→生成下載
- 委員名冊管理（per 學年度 .md，Obsidian 內可編輯）
- AI 草擬說明（參考歷史同類會議）
- 自動推測會議次數 + 今日日期
- 共用元件（HeaderForm, SectionEditor, StudentPicker, DownloadPanel, HistoryReference）
- Python --json mode：spc_meeting_core.py 支援 stdin/stdout JSON 與 API route 整合

### 關鍵檔案
- src/components/skills/workstations/education/ — 前端元件（11 個）
- src/app/api/education/ — API routes（committee, spc-meeting）
- src/lib/education/ — obsidian-paths, committee-parser, spc-history
- docs/superpowers/specs/2026-04-05-meeting-workstation-ui-design.md — UI 設計文件
- docs/superpowers/plans/2026-04-05-meeting-workstation-ui-phase1.md — Phase 1 實作計畫

## 三條主線待續（依優先順序）

### 主線 1：特推會備會 + 多格式產出（使用者最新需求）

使用者希望特推會面板不只產「會後記錄」，也要能產「會前附件」：
- **參考文件上傳**（C 模式）：會議層級 + 案由層級都可上傳 Word/PDF
- **開會前附件產出**：.docx / .pdf / GitHub Pages HTML（一頁式會議議程）
- 專用 GitHub repo，每次會議一個 HTML 靜態頁面
- 需要另開 spec 設計，memory 裡有詳細記錄（project_spc_meeting_expansion.md）

### 主線 2：學生資料 Spec A

使用者想建立學生個別 .md 檔（存 Obsidian），作為跨模組共用資料層：
- IEP 會議、特推會、服務計劃、課程計劃都能讀取帶入
- 資料散落在 IEP 文件、課程計劃分組名單、相關服務申請、鑑定安置資料
- 需設計 .md 格式（frontmatter 欄位）和整理流程

### 主線 3：IEP 會議面板 Phase 2

共用元件已就位，需新增：
- AudioUploader（拖曳上傳 .m4a）
- WhisperProgress（whisper 轉錄進度條，polling）
- MeetingTypePicker（期初/期末/合開）
- SplitTabs（合開拆分 tab 切換）
- API routes：transcribe, analyze, generate
- 合開拆分：AI 自動偵測 + 可手動標記
- 設計文件已有：docs/superpowers/specs/2026-04-05-meeting-workstation-ui-design.md

## 遺留事項
- Multi-Provider 收尾（session-03 留的，低優先）
- openai module build error 需處理（src/lib/llm-provider.ts）
- runPython helper 在 draft 和 generate route 重複，可抽共用

## 設計規則（已存 memory）
- Dashboard 面板必須滿版響應式（不能用 max-w-* 限制）
- 使用者主要在 Mac Mini 桌面環境操作

## 環境資訊（Mac Mini）
- Discord Bot 用 tmux 常駐：tmux attach -t discord-bot
- Dashboard 用 launchd 常駐：port 3000 / Tailscale 8445
- QMD MCP 已接入 Claude Code（stdio 模式）
- whisper medium + LibreOffice 已安裝
```

---

## Discord Bot 行為規則

收到訊息時系統自動加 👀。任務結束後用 `react` 工具加：✅ 完成 / ❌ 失敗。

- 用繁體中文回覆，簡潔直接
- 失敗時說明原因，不要沉默不回應
