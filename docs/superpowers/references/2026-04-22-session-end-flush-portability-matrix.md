---
title: SessionEnd Flush 可攜性矩陣
date: 2026-04-22
type: reference
related:
  - docs/superpowers/specs/2026-04-17-session-end-flush-design.md
  - docs/superpowers/plans/2026-04-18-session-end-flush.md
  - issue: "#2"
---

# 換 AI harness 時的可攜性盤點

把 CycloneOS SessionEnd Flush 的 hook 架構搬到 Codex CLI / Cursor / 其他 harness 時，哪些零改、哪些要動、多少工時。

## TL;DR

- **Markdown 輸出（交接單、memory、spec/plan、CHANGELOG）100% 可攜**
- **Hook 腳本本體（bash + jq）100% 可攜** — 不綁 Claude Code
- **真正要改的只有「誰來觸發 hook」這一層**，各 AI 工具不同

## 詳細矩陣

| 層 | 換 Codex CLI | 換 Cursor |
|:--|:--|:--|
| `CORE_RULES.md` | 零改（已有 `generate-portability.sh` 產 AGENTS.md）| 零改（產 `.cursorrules`）|
| Session log Markdown 輸出 | 零改 | 零改 |
| `lib/ai-extract.sh` provider 層 | 零改（`CYCLONE_AI_PROVIDER=codex` 已預留）| 零改 |
| `lib/transcript-parse.sh` | +10 行 jq（Codex transcript 是不同格式）| SQLite 挖（Cursor 對話存 SQLite）|
| `save-session.sh` / `worker.sh` 本體 | 零改（純 bash）| 零改 |
| Hook 註冊（誰觸發）| 🔴 要改：改註冊到 Codex 的 hook config | ⚠️ Cursor 沒有 SessionEnd 概念 |
| `~/.claude/projects/memory/` 路徑 | 🔴 要遷移內容到新位置 | 同左 |

## 具體換用路徑

### 換 Codex CLI — 大約 1–2 小時

1. 查 Codex 的 hook config（類似 `~/.codex/config.toml`）
2. 把 `save-session.sh` 註冊成 Codex 的 session-end 事件
3. `transcript-parse.sh` 加 `codex-cli` format 分支
4. Memory 檔從 `~/.claude/projects/.../memory/` 搬到 Codex 對應位置
5. `CYCLONE_AI_PROVIDER=codex` 讓 codex 自己萃取自己的 transcript

### 換 Cursor — 不一樣的故事

Cursor 是 IDE，沒有 process-level SessionStart/SessionEnd 生命週期。替代方案：

- **觸發器換掉**：用 launchd / cron 跑 `save-session-worker.sh`；transcript 從 Cursor 的 SQLite 挖
- **改成手動**：`/session-log` 命令觸發，放棄自動化
- **混用**：Codex CLI 做 CLI 工作、Cursor 做編輯，hook 綁在 Codex 上

**誠實講**：Cursor 這條路線比較彆扭，不是架構不夠可攜，是 Cursor 本身沒這種生命週期。

## 為此準備的設計決定

1. `lib/` 抽象層 — Provider + transcript format 都是 pluggable
2. Dispatcher + worker 拆開 — Worker 純 bash，可被任何觸發源呼叫（cron / launchd / 另一個 AI 的 hook）
3. 輸出都是 Markdown + YAML frontmatter — 任何工具讀得懂
4. cyclone-dotfiles 是 git repo — 換機器 `git clone` 就拿到所有腳本

## 不可攜的三個部分（老實講）

- `~/.claude/settings.json` 的 hook 註冊 — Claude Code 專屬 schema
- `~/.claude/projects/.../memory/` 路徑 — Claude Code 專屬路徑
- transcript jsonl 格式 — Claude Code 專有

三個加起來，換 harness migration 大約半天以內。

## 下次要補強的方向

- **A**. 把 openai-api / ollama 從 stub 做成真實作 → 5 個 provider 全部可用（~3–4h）
- **B**. 加 codex-cli / cursor 的 transcript format adapter → 真的跨 harness 吃 transcript（~2–3h）
- **C**. 把 hook 註冊本身抽象化 → 做一個 provider-config 產生器，切換 harness 變成配置改動（~2h）
- **D**. 打包成「離開 Claude Code 遷移腳本」 → 一鍵搬家（~半天）

建議順序：**C → B → A → D**
