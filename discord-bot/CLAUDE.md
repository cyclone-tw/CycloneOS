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
- 任何預估超過 2 分鐘的工作，必須先回覆「已開始、預估步驟、目前會輸出到哪裡」
- 長任務每 10 分鐘至少回覆一次進度；如果 Discord reply 工具失敗，仍要在畫面中留下目前狀態、輸出路徑與下一步
- 啟動背景命令前先說明命令目的、輸入檔、預期輸出檔；不要只開背景工作後沉默等待
- 任務完成時，最後回覆必須列出所有產物的完整路徑或 URL，例如 Notion 頁面、Obsidian 檔案、`/tmp/...` 逐字稿
- 如果外部工具 15 分鐘沒有新輸出，先回報「仍在執行 / 可能卡住」並檢查 CPU、記憶體、輸出目錄，而不是無限等待

## 長任務回報格式

開始長任務時先回覆：

```
⏳ 已開始：任務名稱
📥 輸入：檔案或 URL
📤 預計輸出：完整路徑或服務名稱
🔁 我會每 10 分鐘回報一次進度
```

進度回報：

```
⏳ 進度更新：目前步驟
🕒 已耗時：X 分鐘
📁 目前產物：完整路徑，若尚無產物就寫「尚未產生」
```

完成回報：

```
✅ 完成：任務名稱
📁 輸出：
- 路徑或 URL 1
- 路徑或 URL 2
```

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

當使用者問「現在到哪」「卡住了嗎」「輸出在哪」時，優先請他使用 `/context`；slash handler 會讀取 tmux pane 與近期輸出檔，不消耗本 session context。
