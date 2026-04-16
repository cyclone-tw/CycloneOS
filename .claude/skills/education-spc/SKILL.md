---
name: education-spc
description: "特推會（SPC）會議記錄生成工作流：4 步表單、委員管理、提案草稿、記錄/議程生成、PII 遮蔽。操作 education 模組時自動載入。"
user-invocable: false
---

# 特推會（SPC）會議記錄工作流

SPC = 特殊教育推行委員會。此 skill 描述 CycloneOS Education 工作站中，特推會會議記錄的完整生成流程。

---

## 工作流總覽

```
使用者填 4 步表單 → 存草稿到 Obsidian → AI 輔助提案草稿 → 生成 .docx/.html → PII 遮蔽 → 下載/發佈
```

---

## 關鍵路徑

### 資料模型（TypeScript）
- `src/lib/education/spc-session.ts` — SpcSessionData 型別 + 序列化
- `src/lib/education/committee-parser.ts` — 委員名冊管理
- `src/lib/education/spc-history.ts` — 歷史記錄查詢
- `src/lib/education/pii-mask.ts` — PII 遮蔽工具
- `src/lib/education/obsidian-paths.ts` — Obsidian 目錄路徑

### API Routes
- `api/education/spc-meeting/load` — GET 列出草稿 / POST 載入 session
- `api/education/spc-meeting/save-draft` — POST 存草稿到 Obsidian
- `api/education/spc-meeting/draft` — POST AI 輔助提案草稿
- `api/education/spc-meeting/history` — GET 歷史記錄查詢
- `api/education/spc-meeting/generate` — POST 生成記錄/議程
- `api/education/committee/` — GET 載入 / PUT 儲存名冊
- `api/education/committee/copy` — POST 複製前一年名冊

### UI 元件
- `src/components/skills/workstations/education/spc-meeting/spc-meeting-panel.tsx` — 4 步主面板

### Python 引擎
- `scripts/education/spc_meeting_core.py` — 核心生成邏輯（.docx / .html / MOC 更新）

---

## 4 步表單流程

### Step 1：基本資訊（MeetingHeaderForm）
- 學年度、次數、日期、時間、地點、主席、記錄
- 自動載入委員名冊

### Step 2：前次決議 + 業務報告
- 前次會議決議追蹤
- 業務報告
- 會議層級參考文件

### Step 3：提案（ProposalForm）
- 提案類型（交通補助、專團申請、課程調整等）
- 提案標題、說明、決議
- 受影響學生（姓名、班級、障別、細項）
- 參考公文字號
- 提案層級參考文件

### Step 4：最終資訊（MeetingSectionEditor）
- 臨時動議
- 散會時間
- GitHub Pages 發佈旗標（prep 模式）

---

## 資料結構

```typescript
interface SpcSessionData {
  meta: SpcSessionMeta     // frontmatter（學年/次數/日期/狀態等）
  previousDecisions: string // 前次決議追蹤
  businessReport: string    // 業務報告
  proposals: Proposal[]     // 提案陣列
  motions: string           // 臨時動議
}
```

### Session 狀態流
```
draft → agenda-generated → record-generated
```

### 模式
- `prep` — 會前準備模式（生成議程）
- `record` — 會後記錄模式（生成記錄）

---

## 儲存位置

| 類型 | 路徑 |
|------|------|
| Session 草稿/記錄 | `{Vault}/02-特教業務/特推會/{year}-特推會-{num}-{topic}.md` |
| 委員名冊 | `{Vault}/02-特教業務/特推會/委員名冊/{year}-特推會委員名冊.md` |
| MOC 索引 | `{Vault}/02-特教業務/特推會/moc-特推會.md` |
| Word 檔（.docx） | 由 Python 引擎生成，回傳為 blob 下載 |
| HTML 議程 | 選擇性發佈到 GitHub Pages（`cyclone-tw/meetings`）|

---

## PII 遮蔽規則

- `maskName()` — 中文姓名遮蔽（王大明 → 王○明）
- `maskPII()` — 姓名 + 地址 + 電話全面遮蔽
- **Obsidian .md 保留原始資料**（內部使用）
- **發佈用 .docx/.html 必須遮蔽**（對外分發）

---

## 修改此模組時注意

1. 任何提案類型的異動 → 確認 Python 端的 `PROPOSAL_TYPES` 同步
2. Frontmatter 欄位異動 → 確認 `spc-session.ts` 的 parse/serialize 同步
3. 委員名冊格式異動 → 確認 `committee-parser.ts` 的 parse/write 同步
4. .docx 樣式修改 → 改 Python `spc_meeting_core.py`
5. PII 遮蔽範圍擴充 → 改 `pii-mask.ts`
