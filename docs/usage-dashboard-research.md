# AI Usage Dashboard 整合研究

> 2026-04-21 研究，來源 session：MacBook 上的 `/Users/username/Github/01-Repo/token-dashboard/` 空 repo（已決定不用，改整合進 CycloneOS）

## 目標

把 Claude / ChatGPT / Gemini / GLM 等 AI 訂閱用量整合成單一 dashboard，整合進 CycloneOS Next.js app（預計新增 `/usage` 路由）。

## 架構決策

- **不要另開 repo**，整合進 CycloneOS
- **開發在 MacBook，部署/執行在 Mac mini**（Mac mini 才讀得到 OpenClaw 與主要 Claude Code JSONL logs）
- MacBook 的 logs 要透過 Tailscale/rsync 同步到 Mac mini，或 MacBook 也跑一個 agent 上報
- 遵守 CycloneOS 最高原則：資料來源 adapter 要抽象化（跟 `src/lib/llm-provider.ts` 一樣的思路）

## 現成工具調研（可參考實作 / 可能直接嵌入）

### 首選參考

| 工具 | 支援的服務 | 型態 | 為什麼列入 |
|------|-----------|------|-----------|
| [TokenTracker](https://github.com/mm7894215/TokenTracker) | Claude Code, Codex, Cursor, Gemini, Kiro, OpenCode, OpenClaw | 網頁 dashboard + macOS menu bar + 桌面 widget | 介面最接近「dashboard」目標，local-first |
| [Tokscale](https://github.com/junhoyeo/tokscale) | OpenCode, Claude Code, **OpenClaw (Clawdbot/Moltbot)**, Pi, Codex, Gemini, Cursor, AmpCode, Factory Droid, Kimi | CLI + Rust TUI | 覆蓋最廣，明確支援 OpenClaw |
| [CodexBar](https://github.com/steipete/CodexBar) | Codex, Claude, Cursor, Gemini, Antigravity, Droid, Copilot, **z.ai (GLM)**, Kiro, Vertex AI, Augment, Amp, JetBrains AI, OpenRouter, Perplexity, Abacus AI | macOS menu bar | **唯一明確支援 GLM (z.ai)**，關鍵 |

### 次選（單一服務，可拆用其邏輯）

- [ccusage](https://github.com/ryoppippi/ccusage) — Claude Code + Codex JSONL 解析的標杆，很多工具是 fork/inspired from
- [Claude-Code-Usage-Monitor](https://github.com/Maciek-roboblog/Claude-Code-Usage-Monitor) — 有預測/警告
- [MyCCusage](https://github.com/i-richardwang/MyCCusage) — self-hosted 網頁版 Claude Code analytics
- [claude-usage](https://github.com/phuryn/claude-usage) — localhost:8080 Chart.js dashboard
- [ai-token-monitor](https://github.com/soulduse/ai-token-monitor) — macOS 系統列
- [toktrack](https://github.com/mag123c/toktrack) — Rust，多 CLI 整合

### 不適合（方向不符，仍列出以免重複研究）

- [LiteLLM](https://github.com/BerriAI/litellm) — API gateway，要走 proxy
- [Helicone](https://github.com/Helicone/helicone) — LLM observability，要走 proxy
- [LLM Gateway](https://github.com/theopenco/llmgateway) — 多 provider router
- [VoidLLM](https://github.com/voidmind-io/voidllm) — self-hosted LLM proxy
- [OpenLLM Monitor](https://github.com/prajeesh-chavan/OpenLLM-Monitor) — API 呼叫監控
- [tokenx](https://github.com/dvlshah/tokenx) — Python decorator，需包裝呼叫
- [tokentap](https://github.com/jmuncor/tokentap) — 攔截 API 流量
- [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI) — 把 CLI 包成 API service
- [TokensAI](https://tokensai.dev/) — SaaS，非 self-hosted

以上都需要 API proxy 或 SaaS，不適合追蹤純 Pro/Plus **訂閱**用量。

## 資料來源盤點（實作前要確認）

| 服務 | 資料來源 | 備註 |
|------|---------|------|
| Claude Code | `~/.claude/projects/**/*.jsonl` | ccusage 解析格式可參考 |
| OpenClaw | Mac mini 上的 log 路徑（待確認） | Tokscale 有 adapter 可參考 |
| Codex | `~/.codex/**` | ccusage v2+ 支援 |
| ChatGPT (Plus 訂閱) | **無官方本地 log**，只能看 chatgpt.com 官方介面 | 最難處理，可能要靠 browser extension 或跳過 |
| Gemini | CLI 有 local log；訂閱網頁版同 ChatGPT 問題 | |
| GLM (z.ai) | CodexBar 有做，可研究其方法 | |

## 建議下一步（開新 session 用 `/superpowers:brainstorm`）

1. 確認 Mac mini 上 OpenClaw / Claude Code log 實際路徑與格式
2. 決定 MVP 範圍：先做哪幾家？（建議：Claude Code + OpenClaw + Codex 最容易，ChatGPT/Gemini 訂閱版最後）
3. 設計 adapter interface（`src/lib/usage-provider.ts`？）呼應 CycloneOS 最高原則
4. 決定資料聚合策略：
   - (a) CycloneOS 跑在 Mac mini，直接讀本機 + MacBook rsync 上來的 logs
   - (b) 各機跑小 agent 上報 → CycloneOS API 收集到 DB
5. UI：參考 TokenTracker / ccusage 的視覺設計

## 待刪除

- `/Users/username/Github/01-Repo/token-dashboard/`（空資料夾，棄用）
