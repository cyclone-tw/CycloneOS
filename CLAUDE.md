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

## 🔜 Next Session: Multi-Provider 收尾 + 程式碼品質

> 複製以下內容作為新 session 的第一句話，然後刪除此區塊。

```
接續上次 session（2026-04-04-session-03）。上次完成了 multi-provider LLM 支援（commit e3f3609），這次要收尾和驗證。

## 目前狀態
CycloneOS 的 LLM 抽象層現在支援三種 provider：
- ClaudeCLIProvider（預設，spawn claude CLI）
- CodexCLIProvider（spawn codex CLI）
- OpenAIProvider（直接呼叫 OpenAI API）

Dashboard UI 右下角有 Provider Selector 可切換 Claude CLI / Codex CLI，Model Selector 會根據 provider 動態顯示對應模型。

環境變數切換：LLM_PROVIDER=claude|codex|openai, OPENAI_API_KEY, OPENAI_MODEL

## 要做的事

### 1. 程式碼品質修復
- `extractCodexText` 函數重複定義在 3 個檔案中（llm-provider.ts、chat/route.ts、local-executor.ts），抽成共用模組
- `setLLMProvider` 被改成 no-op（`void provider;`），評估是否恢復或移除
- `getLLMProvider` 每次都 new instance（singleton 被移除），考慮恢復快取
- `claude-bridge.ts` 和 `llm-provider.ts` 有部分功能重疊（都有 Codex args builder），可統一

### 2. 驗證
- 用 OpenAI provider 跑一次 yt-notes pipeline（需設定 OPENAI_API_KEY）
- 在 Dashboard 聊天測試 Codex CLI provider
- 確認 Obsidian + Notion 輸出正常

### 3. 清理
- 評估是否刪除 ~/CycloneOS-codex（主 repo 已有所有改動）
- 修復 pre-existing build 問題（public/uploads/felo/images symlink）

## 已知限制（Codex CLI）
- 沒有 MCP 支援 → QMD 搜尋等 MCP 功能不可用
- 沒有 --append-system-prompt → 改用 prompt 前置拼接（品質可能不同）
- 沒有 --disallowed-tools → 無法限制工具
- Session resume 機制不同，待驗證

## 關鍵檔案
- src/lib/llm-provider.ts — 三種 provider 實作
- src/lib/claude-bridge.ts — 雙 CLI spawn
- src/components/chat/provider-selector.tsx — UI 切換元件
- src/types/chat.ts — AgentCliProvider 型別
- src/stores/agent-store.ts — provider 狀態管理
```

---

## Discord Bot 行為規則

收到訊息時系統自動加 👀。任務結束後用 `react` 工具加：✅ 完成 / ❌ 失敗。

- 用繁體中文回覆，簡潔直接
- 失敗時說明原因，不要沉默不回應
