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

## 🔜 Next Session: Discord Bot 部署驗證 + 指令測試

> 複製以下內容作為新 session 的第一句話，然後刪除此區塊。

```
接續 MacBook session（2026-04-08）。Discord Bot 指令系統已實作，需要在 Mac Mini 部署驗證。

## 剛完成的變更（已 push 到 main）

3 個 commit：
- discord-bot/CLAUDE.md — Bot 專用設定檔（指令規則、session 追蹤、Obsidian 寫入規則）
- scripts/discord-bot.sh — while-loop wrapper + working dir 改 ~/discord-bot/
- CLAUDE.md — bot 規則搬到 discord-bot/CLAUDE.md，主檔只留指向說明

### 架構變更
- Bot 不再讀 CycloneOS/CLAUDE.md（避免載入無關的教育工作站、特推會等 context）
- Bot 使用獨立工作目錄 ~/discord-bot/，啟動腳本自動從 repo 複製最新 CLAUDE.md
- while-loop 自動重啟（bot exit 後 2 秒重開）

## 最優先：部署驗證（Task 4 + Task 5）

### Task 4：驗證 while-loop 重啟機制

1. `git pull` 拉最新
2. `bash scripts/discord-bot.sh` 啟動 bot
3. `tmux ls` 確認 session 存在
4. `ls ~/discord-bot/CLAUDE.md` 確認 CLAUDE.md 已複製
5. `tmux attach -t discord-bot` 進入確認 while-loop 運行
6. Ctrl+C 中斷 Claude Code → 確認 2 秒後自動重啟
7. Ctrl+B D 離開 tmux

### Task 5：測試 Bot 指令（Discord 端）

1. `/context` → 確認回傳運行時間、訊息數、context 數據
2. 發 2-3 則一般訊息讓 bot 處理
3. 再次 `/context` → 確認訊息數和摘要更新
4. `/session-log` → 確認 Obsidian Discord/bot-logs/ 有新檔案，格式正確
5. `/new` → 確認寫日誌 + handoff + 通知「重啟中」+ bot 重新上線
6. 重啟後 `/context` → 確認 session 是乾淨的

### 設計文件
- docs/superpowers/specs/2026-04-08-discord-bot-commands-design.md
- docs/superpowers/plans/2026-04-08-discord-bot-commands.md

## 環境資訊（Mac Mini）
- Discord Bot 用 tmux 常駐：tmux attach -t discord-bot
- Dashboard 用 launchd 常駐：port 3000 / Tailscale 8445
- QMD MCP 已接入 Claude Code（stdio 模式）
- whisper medium + LibreOffice 已安裝
```

---

## Discord Bot

Bot 使用獨立工作目錄和專用 CLAUDE.md，規則定義在 `discord-bot/CLAUDE.md`。

啟動：`bash scripts/discord-bot.sh`（tmux while-loop，auto-restart）
