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

## 🔜 Next Session: Smoke Test + 學生資料 Spec + IEP 面板

> 複製以下內容作為新 session 的第一句話，然後刪除此區塊。

```
接續 session-07 + session-08（2026-04-07，Mac Mini，兩個平行 session）。
社群發文模組 MVP + 特推會 Phase 2 已完成並合併 main。

## 已完成（session-07）：社群發文模組 MVP

智慧轉發器（Smart Reposter）— 素材→LLM 改寫→多平台貼文→Notion 中樞：
- 5 個平台：FB/IG/LINE/學校網站/Notion
- 3 種語氣：知識分享/日常/活動宣傳
- 素材來源：直接輸入 + QMD 搜尋 Obsidian 筆記
- 圖片拖曳上傳（純附件，不用 AI Vision）
- LLM 串流生成各平台版本（SSE）
- 一鍵複製 + 發布到 Notion Database（n8n-friendly schema）
- 歷史記錄從 Notion 拉取
- Notion Database 已建立（NOTION_SOCIAL_DATABASE_ID 在 .env.local）
- QMD 索引已擴展：CycloneOS/ + 其他遺漏資料夾全部加入（1146→1249 篇）

### 關鍵檔案
- src/components/skills/workstations/social/ — 前端元件（6 個）
- src/app/api/social/ — API routes（5 個：generate, publish-notion, history, upload-image, qmd-search）
- src/lib/social/ — prompts.ts, notion.ts
- src/lib/notion-utils.ts — 共用 markdownToBlocks（從 yt-notes 抽出）
- src/stores/social-store.ts — Zustand store
- docs/superpowers/specs/2026-04-06-social-posting-module-design.md
- docs/superpowers/plans/2026-04-07-social-posting-module.md

## 已完成（session-08）：特推會 Phase 2

雙模式面板（備會 prep / 記錄 record）+ 多格式產出：
- 備會模式：產出會前附件（.docx + GitHub Pages HTML）
- 參考文件上傳（會議層級 + 案由層級，拖曳/瀏覽）
- .md 暫存（Obsidian 內可讀，面板可載入還原）
- Style-C HTML 模板（報紙排版風）
- PII 遮蔽（TS + Python 雙端，.md 存全名，產出時遮蔽）
- GitHub Pages push（共用模組，簡報和會議共用）
- 未完成會議自動偵測 + 載入

### 關鍵檔案
- src/lib/education/pii-mask.ts, spc-session.ts
- src/lib/github-pages.ts — 共用 GitHub Pages push
- src/components/.../spc-meeting/ — ref-file-picker, session-loader
- src/app/api/education/spc-meeting/ — save-draft, load routes
- scripts/education/html_template.py — Style-C HTML
- docs/superpowers/specs/2026-04-07-spc-meeting-phase2-design.md
- docs/superpowers/plans/2026-04-07-spc-meeting-phase2.md

## 最優先：Smoke Test 兩個新模組

### 社群發文模組
1. Dashboard → Skills → 社群發文模組
2. 輸入文字 → 選 FB + IG → 知識分享 → 生成
3. 複製文字 → 存到 Notion → 確認 Notion page 欄位正確
4. QMD 搜尋筆記 → 載入 → 生成
5. 圖片上傳 → 發布 → 確認 Image URLs 欄位

### 特推會 Phase 2
1. 切換備會/記錄模式
2. 備會模式：填資料 → 上傳參考文件 → 生成 .docx + HTML
3. 暫存 → 關閉 → 重開 → 確認載入還原
4. 需先建立 cyclone-tw/meetings GitHub repo

### 已知待修
- hashtags 型別不一致（string vs string[]，prompt/store/API 之間）
- PostHistory status 值處理（Notion 回中文，store 定義英文）
- openai module build error（pre-existing）
- runPython helper 重複（generate + draft routes）

## 其他主線待續

### 主線：學生資料 Spec
- 建立學生個別 .md 檔（存 Obsidian），作為跨模組共用資料層
- IEP 會議、特推會、服務計劃、課程計劃都能讀取帶入
- 需設計 .md 格式（frontmatter 欄位）和整理流程

### 主線：IEP 會議面板 Phase 2
- 共用元件已就位，需新增 AudioUploader, WhisperProgress 等
- 設計文件：docs/superpowers/specs/2026-04-05-meeting-workstation-ui-design.md

### 社群模組後續
- Discord bot 指令整合（API 已共用）
- Cloudflare R2 圖片儲存（替代 public/uploads/）
- n8n workflow 設定
- Notion Database Views 建立

## 環境資訊（Mac Mini）
- Discord Bot 用 tmux 常駐：tmux attach -t discord-bot
- Dashboard 用 launchd 常駐：port 3000 / Tailscale 8445
- QMD MCP 已接入 Claude Code（stdio 模式）
- QMD 索引設定：~/.config/qmd/index.yml（16 collections）
- whisper medium + LibreOffice 已安裝

## 設計規則
- Dashboard 面板必須滿版響應式（不能用 max-w-* 限制）
- 使用者主要在 Mac Mini 桌面環境操作
- Notion 屬性名稱用英文（避免中英混用 API 對接問題）
```

---

## Discord Bot

Bot 使用獨立工作目錄和專用 CLAUDE.md，規則定義在 `discord-bot/CLAUDE.md`。

啟動：`bash scripts/discord-bot.sh`（tmux while-loop，auto-restart）
