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

## 🔍 Pending: AI Usage Dashboard 整合（2026-04-21 研究完成）

待開新 session 規劃整合。研究成果在 [`docs/usage-dashboard-research.md`](docs/usage-dashboard-research.md)。

**重點**：
- 整合 Claude / OpenClaw / Codex / ChatGPT / Gemini / GLM 用量
- 不另開 repo，做成 CycloneOS 的 `/usage` 路由
- 開發在 MacBook，部署/執行在 Mac mini（讀得到 logs 的地方）
- 首選參考工具：TokenTracker、Tokscale、CodexBar、ccusage
- 建議下次用 `/superpowers:brainstorm` 開 session 做 MVP scoping

---

## 🔜 Next Session

（目前無待接續工作）

---

## Discord Bot

Bot 使用獨立工作目錄和專用 CLAUDE.md，規則定義在 `discord-bot/CLAUDE.md`。

啟動：`bash scripts/discord-bot.sh`（tmux while-loop，auto-restart）

### Bot 故障排查（使用者提到 bot 有問題時自動執行）

當使用者反映 bot 沒反應、掛了、不回訊息等問題時，**不要直接重啟**，先依序檢查：

1. `tmux list-sessions` — 確認 `discord-bot` 和 `slash-handler` session 是否存在
2. `tmux capture-pane -t discord-bot -p -S -30` — 看 bot 最近輸出，是否卡住或已斷線
3. `tmux capture-pane -t slash-handler -p -S -20` — 看 slash handler 狀態
4. `cat ~/discord-bot/bot-loop.log` — bot 啟動/退出歷史
5. `cat ~/discord-bot/slash-handler.log` — slash handler crash 紀錄與原因

根據日誌判斷原因後，再決定是否需要 `bash scripts/discord-bot.sh` 重新部署。
