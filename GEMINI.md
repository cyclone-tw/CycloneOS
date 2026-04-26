# Gemini CLI Rules — auto-generated from CORE_RULES.md
# 修改請改 CORE_RULES.md，然後重新跑 generate-portability.sh

# Cyclone — AI Agent 核心規則

> 這份檔案是所有 AI 工具共用的核心規則。
> Claude Code 透過 CLAUDE.md 載入、Cursor 透過 .cursorrules、Codex 透過 AGENTS.md、Gemini 透過 GEMINI.md。
> 修改這份檔案等於同時更新所有 AI 工具的行為。

---

## 使用者

- **Cyclone** — 教育工作者（特教）/ 產品負責人
- 溝通語言：繁體中文（程式碼、技術名詞可用英文，避免簡體用詞）
- 裝置：Mac Mini（家用伺服器）+ MacBook（外出）
- 核心系統：CycloneOS Dashboard（Next.js）、Obsidian Vault（Google Drive）、Discord Bot
- 有 CTO 協作者（dar），GitHub 產出需維持專業水準
- 開發模式：口述需求 → AI 實作，對架構設計有判斷力

---

## 協作偏好

- 回覆簡潔直接，不需要每次末尾總結「以上做了什麼」
- 技術溝通可以直接用工程師語氣，不用過度解釋
- 有明確下一步時直接做，不要反覆確認「要不要繼續？」
- 大任務先規劃再執行（discussion session → plan.md → execution session）
- 一次一件事，做完再下一個
- AI 做錯了直接說，不用客氣
- GitHub issue / PR / commit message 維持專業工程師水準

---

## 寫作風格

- 繁體中文為主，技術名詞保留英文
- 避免簡體用詞：視頻→影片、信息→訊息、用戶→使用者
- 不加 emoji（除非明確要求）
- 程式碼註解用中文：`// 取得使用者偏好`

---

## 開發原則

### AI Agent 無關性（MANDATORY）

所有程式碼不得與特定 AI 綁死：
1. LLM 呼叫走抽象層，不直接 import 特定 SDK
2. Prompt 與邏輯分離，prompt template 可獨立替換
3. 外部 API 獨立封裝，與 AI 層解耦
4. Context 格式可攜，使用標準 JSON/Markdown

### Commit 規範

Conventional Commits 格式：
- `feat:` 新功能 / `fix:` 修 bug / `docs:` 文件 / `chore:` 雜務 / `refactor:` 重構
- 有對應 issue 時結尾加 `(#issue編號)`
- 完成 issue 時寫 `Closes #issue編號`

---

## 路徑參考

| 用途 | 路徑 |
|------|------|
| CycloneOS Dashboard | `~/Cyclone-System/CycloneOS/` |
| AI Agent 全域配置 | `~/.claude/` |
| 系統配置 + Hooks | `~/.cyclone/` |
| Obsidian Vault | Google Drive CloudStorage（路徑因機器而異，從 `~/.cyclone/config.json` 讀取） |
| Git repos | `~/Github/01-Repo/` |
| Discord Bot 工作目錄 | `~/discord-bot/`（Mac mini）/ `~/Cyclone-System/CycloneOS/discord-bot/`（MacBook） |

---

## Obsidian Vault 操作規則

- Google Drive CloudStorage 路徑禁用 `ls`/`find`（會 timeout）
- 一律用工具的檔案搜尋 + 直接寫入
- Markdown frontmatter 用 YAML 格式
- 內部連結用 `[[wiki link]]` 語法
- 寫入任何 Markdown 到 Obsidian 前，必須先讀 vault 共用規範：
  - `000_Agent/PROJECT_ROUTING.md`
  - `000_Agent/OBSIDIAN_METADATA_SCHEMA.md`
- 不得自創新的 vault 頂層資料夾或 frontmatter 欄位；路由不明時寫入
  `_Agent-Inbox/`，並使用 `status: needs-review`
