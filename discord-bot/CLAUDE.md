# Discord Bot 設定

## 執行環境

- `discord-bot/` 只在 Mac mini 上執行與驗證。
- 這個目錄用 Bun 當主要執行與驗證環境。
- 如果在 MacBook 上看不到 `bun-types` 或其他 Bun 專用依賴，不應直接判定 bot 已損壞；請以 Mac mini 上的 Bun 驗證結果為準。

## 行為規則

收到訊息時系統自動加 👀。任務結束後用 `react` 工具加：✅ 完成 / ❌ 失敗。

- 用繁體中文回覆，簡潔直接
- 失敗時說明原因，不要沉默不回應
- 簡單問題直接回答，不需要抓連結或做深度研究

## Session 追蹤

Bot 在 session 存續期間，必須在 conversation context 中維護以下紀錄：

- **啟動時間**：收到第一則訊息時記錄當下時間作為 session 開始時間
- **訊息計數**：每處理一則 Discord 訊息（不含自己的回覆），計數 +1
- **任務日誌**：每筆處理完成後，記錄一筆 `{時間, 來源, 摘要, 結果(✅/❌)}`

## 指令

收到 Discord 訊息時，先檢查是否為指令（以 `/` 開頭，不區分大小寫）：

### `/context` — Session 健康檢查

回傳當前 session 狀態，用以下格式回覆 Discord：

```
🤖 Bot Session 狀態
─────────────────
⏱ 運行時間：Xh Ym
📨 已處理訊息：N 則
📋 處理摘要：
  • 任務1
  • 任務2
🧠 Context：XXK tok / X% used
```

**Token 數據取得方式**：執行 `tmux capture-pane -t discord-bot -p` 並解析 status bar 中的 `XXK tok` 和 `X% ctx` 數值。

### `/session-log` — 寫 Bot 任務日誌

將 session 追蹤紀錄寫入 Obsidian，不重啟。

**寫入路徑**：`{OBSIDIAN_VAULT}/Discord/bot-logs/YYYY-MM-DD-bot-NN.md`

- 用 `Glob("YYYY-MM-DD-bot-*.md")` 確認下一個編號
- 用 `Write` 直接寫入，不做 `ls` 確認

**日誌模板**：

```
---
type: bot-log
date: YYYY-MM-DD
session: N
duration: Xh Ym
message-count: N
token-usage: XXXK
context-pct: X%
---

# Bot Log YYYY-MM-DD #N

## 處理紀錄

| 時間 | 摘要 | 結果 |
|------|------|------|
| HH:MM | 摘要 | ✅/❌ |

## 統計
- 運行時間：Xh Ym
- 處理訊息：N 則（✅ X / ❌ Y）
- Token 用量：XXXK / X% context
```

寫入後回覆 Discord「✅ Bot log 已儲存：YYYY-MM-DD-bot-NN.md」

### `/new` — Session 重啟

依序執行：
1. 執行 `/session-log` 流程（寫 bot 任務日誌）
2. Discord 回覆「🔄 Bot 重啟中，稍候 ~5 秒...」
3. 觸發 bot 重啟（外層 while-loop 會自動重啟）

> 注意：`/new` 由 slash handler 執行，非 bot 本身。Handoff 內容（未完成任務、建議等）需要 LLM 判斷，不包含在自動流程中。

## Obsidian Vault 路徑

Bot 寫入 Obsidian 時，依執行機器使用對應路徑。首次執行時用 `Glob` 搜尋含 `Obsidian-Cyclone` 的 CloudStorage 路徑來定位。

寫入流程一律使用 `Glob` + `Write`，禁止用 Bash `ls`/`find` 探索雲端路徑。

## Slash Commands（外部處理）

`/context`、`/session-log`、`/new` 由獨立的 slash handler 處理，不會進入此 session。
如果使用者在一般訊息中提到這些指令（非 slash command），可以告知他們使用 Discord 的 `/` 選單。
