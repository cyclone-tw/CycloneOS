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

## 🔜 Next Session: 教育工作站 Dashboard UI + Multi-Provider 收尾

> 複製以下內容作為新 session 的第一句話，然後刪除此區塊。

```
接續 session-04（2026-04-04，Mac Mini）。有兩條主線待續：

## 主線 1：教育工作站 Dashboard UI（優先）

IEP 會議記錄的 Python pipeline 已完成並驗證可行：
- scripts/education/iep_pipeline.py — 一鍵 pipeline（音檔→whisper→AI分析→從零生成.docx）
- scripts/education/iep_meeting_generator.py — python-docx 從零生成會議記錄
- scripts/education/iep_batch.py — 資料夾分類批次處理（期初/期末/跨學期/跨學年）

### 核心設計決策（已確定）
- 不用佔位符，LLM 自己理解模板結構產出內容
- 不填入現有模板，從零生成 .docx（無殘留內容）
- 簽到表留空（現場簽名）
- 內文 10pt 標楷體
- 逐字稿存 Obsidian（含 frontmatter）
- 檔名中間字用○代替（廖祐仁→廖○仁）
- 日期前綴優先用錄音檔建立日期

### 待做
1. 建立 API route: /api/education/iep-meeting
2. 建立前端元件：
   - 音檔上傳/拖曳
   - 會議類型選擇（期初/期末/跨學期合開/跨學年合開）
   - 學生姓名、日期等欄位
   - whisper 進度顯示
   - AI 分析進度
   - 預覽 + 下載
3. 掛進 skills panel 的教育工作站卡片
4. 雙軌：CLI 批次處理 + Dashboard UI 互動處理
5. 更多錄音檔測試合開拆分邏輯

### 後續模組（設計文件在 docs/specs/education-workstation-design.md）
- IEP 服務計劃模組
- 課程計劃模組
- 教案/一般文件模組

## 主線 2：Multi-Provider 收尾（session-03 留的）

- extractCodexText 重複定義，需抽成共用模組
- setLLMProvider/getLLMProvider singleton 問題
- claude-bridge.ts 和 llm-provider.ts 功能重疊
- Codex CLI 限制：無 MCP、無 --append-system-prompt

## 環境資訊（Mac Mini）
- Discord Bot 用 tmux 常駐：tmux attach -t discord-bot
- Dashboard 用 launchd 常駐：port 3000 / Tailscale 8445
- QMD MCP 已接入 Claude Code（stdio 模式）
- whisper medium + LibreOffice 已安裝
- .zshrc 已移除無效 ANTHROPIC_API_KEY

## 關鍵檔案
- scripts/education/* — Python pipeline（6 個腳本）
- docs/specs/education-workstation-design.md — 完整設計文件
- .claude/commands/{handoff,session-log,changelog}.md — slash commands
- CLAUDE.md — 已瘦身至 42 行
```

---

## Discord Bot 行為規則

收到訊息時系統自動加 👀。任務結束後用 `react` 工具加：✅ 完成 / ❌ 失敗。

- 用繁體中文回覆，簡潔直接
- 失敗時說明原因，不要沉默不回應
