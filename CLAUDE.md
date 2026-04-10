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

## 🔜 Next Session: Slash Commands 驗收 + Hook 驗證

> 複製以下內容作為新 session 的第一句話，然後刪除此區塊。

```
接續 session-01（2026-04-10，Mac Mini）。Slash commands 已實作並部署，/context 已測試通過。

## 已完成
- Slash handler companion script（discord-bot/slash-handler.ts）— 獨立 Bun process 處理 /context、/session-log、/new
- PostToolUse hook（discord-bot/hooks/log-activity.sh）— 自動記錄 bot reply/react 到 .bot-activity.jsonl
- Guild slash commands 已註冊在 Cyclone server（即時生效）
- /context 測試通過（運行時間、訊息數、摘要正確）
- Bot while-loop 重啟機制驗證通過

## 最優先：完成 Integration Test

### 1. Hook 驗證
- 發訊息讓 bot 回覆 → 檢查 `~/discord-bot/.bot-activity.jsonl` 有記錄
- 如果沒有記錄，確認 hook settings 有被 Claude Code 載入（`~/discord-bot/.claude/settings.json`）
- 可能需要用完整 `scripts/discord-bot.sh` 重新部署（目前 bot 是手動簡化啟動的）

### 2. /session-log 測試
- Discord 打 `/session-log`
- 確認 Obsidian `Discord/bot-logs/` 有新檔案
- 確認格式正確（frontmatter + 任務表格 + 統計）

### 3. /new 測試
- Discord 打 `/new`
- 確認寫日誌 + bot 重啟 + activity log 清空
- 重啟後 `/context` 確認乾淨 session

### 4. /context token 數據
- 目前顯示 N/A — tmux capture-pane 可能在新啟動方式下抓不到 status bar
- 調查 alternate screen buffer 問題

### 5. scripts/discord-bot.sh 完整測試
- 用完整腳本重新部署（目前 bot 用簡化腳本手動啟動）
- 確認 hook settings 複製、git init、slash handler 都正常

## 其他主線
- 社群發文模組 + 特推會 Phase 2 smoke test
- 學生資料 .md 格式規劃
- IEP 會議面板 Phase 2

## 環境資訊（Mac Mini）
- Bot: tmux discord-bot（bot-loop.sh while-loop）
- Slash handler: tmux slash-handler（bun run slash-handler.ts）
- Dashboard: launchd 常駐 port 3000 / Tailscale 8445
- QMD MCP 已接入（stdio 模式）
```

---

## Discord Bot

Bot 使用獨立工作目錄和專用 CLAUDE.md，規則定義在 `discord-bot/CLAUDE.md`。

啟動：`bash scripts/discord-bot.sh`（tmux while-loop，auto-restart）
