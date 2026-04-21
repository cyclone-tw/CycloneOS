# CycloneOS Changelog

## 2026-04-19

- SessionEnd hook 自動萃取：對話結束時背景呼叫 `claude -p --model haiku` 讀 transcript，產出 YAML 格式交接單（Summary / Decisions / Pending / Knowledge 四欄）寫入 Obsidian `CycloneOS/sessions/YYYY-MM-DD-session-N-auto.md`
- AI provider 抽象層：`~/.cyclone/scripts/lib/ai-extract.sh` 支援 claude / gemini / codex，openai-api / ollama 留 stub；透過 `CYCLONE_AI_PROVIDER` env 切換，符合 CycloneOS 最高原則「AI Agent 無關性」
- Transcript 格式 adapter：`~/.cyclone/scripts/lib/transcript-parse.sh` 處理 Claude Code jsonl（defensive jq 支援 string/array content，`fromjson?` 跳過壞行）
- SessionStart Daily Brief 升級：現在顯示上次 session log 的 Summary + Pending，新 session 開場立即接手
- Hook 測試框架：`~/.cyclone/scripts/tests/` 純 bash 測試腳本，`run-all.sh` 一鍵跑全部（5 個測試檔，AI 呼叫可選 `CYCLONE_RUN_AI_TESTS=1`）
- 修復 `CYCLONE_IN_HOOK` 遞迴 guard：5 個 hook 開頭皆檢查此 env var，避免子 `claude -p` 觸發父 hook 造成 session log 污染
- 修復 `save-session.sh` 原本假設「SessionEnd 拿不到 transcript」——Hook stdin 實際有 `transcript_path`，現在正確讀取並傳給 background worker

## 2026-04-04
- 修復 Invalid API Key 問題（移除 .zshrc 無效 ANTHROPIC_API_KEY）
- 新增手機版 responsive layout（底部導航列 + dashboard/chat 切換）
- 設定 Tailscale Serve（port 8445）供跨裝置存取
- 新增 favicon 龍圖示
- Discord Bot 部署（Claude Code × Discord Channel Plugin）
- 新增 Discord Bot 開機常駐（tmux + launchd）
- 接入 QMD MCP server，Bot 可語意搜尋 Obsidian Vault
- CLAUDE.md 瘦身（195→42 行），拆出 session-log、handoff、changelog 為 slash commands
- 教育工作站 IEP 模組：whisper 轉寫 + AI 分析 + 從零生成會議記錄 .docx
- IEP 批次處理：資料夾分類（期初/期末/跨學期/跨學年）自動產出
- 教育工作站技術設計文件（含法規依據與最佳實踐研究）

## 2026-04-03
- 移除所有 /Users/username 硬編碼路徑，改用 homedir()/process.cwd()/PATHS — 系統可移植到其他 Mac
- Documents 輸出路徑 UI 改善：分別顯示 MD（Obsidian）與二進位檔（Google Drive）存放位置
- 匯入研究路徑改指向 Obsidian CycloneOS 目錄（outputs、sessions、meeting-notes 等）

## 2026-04-02
- Felo 聊天訊息改用 ReactMarkdown 渲染（支援 GFM、程式碼高亮）
- Felo 進度訊息改用獨立 SSE status 事件 + spinner 灰字顯示
- Push-GitHub 新增 folderName 對話框，推送成功後顯示 GitHub Pages URL
- Felo AI 工作站上線：SuperAgent 對話、生圖、Web Fetch、快捷入口、產出面板
- Felo 生圖功能：SSE 串流 + LiveDoc polling + 圖片下載到 Google Drive
- Felo 對話匯出：每則訊息可匯出為 MD / DOCX / XLSX，支援自訂指令處理
- Documents 工作站：實作 DOCX、PDF、XLSX 輸出（移除 HTML 簡報和 PPTX）
- 簡報工作站：生圖按鈕（串接式 UI）、URL 智慧偵測、push 到 cyclone-tw/slides
- lib/felo/ API client：search、superagent、web-fetch、livedoc 完整封裝
- felo-output-store：Zustand + localStorage persist 產出管理
- 統一輸出路徑：paths-config.ts 集中管理，MD 存 Obsidian，二進位存 Google Drive
- 統一檔名規則：YYYY-MM-DD-{source}-{summary}.{ext}
- AI Agent 無關性原則寫入 CLAUDE.md
- Computer Use 桌面操控架構設計文件
- IME 注音輸入法相容（compositionstart/end）
- Felo SSE 雙重 JSON 解碼 + 自動重連
