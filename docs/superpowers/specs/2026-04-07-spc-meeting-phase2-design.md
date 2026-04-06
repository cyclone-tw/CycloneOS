# 特推會面板 Phase 2：備會模式 + 多格式產出

> CycloneOS Education Workstation — 特推會會議記錄模組擴展
> 日期：2026-04-07
> 基於：Phase 1（2026-04-05）已完成的特推會 4-step 流程

---

## 背景

Phase 1 實作了「會後記錄」生成流程（填表 → AI 草擬 → 預覽 → .docx + .md）。使用者也需要在開會前準備「會前附件」（議程 + 案由說明），分發給委員預先審閱。

Phase 2 擴展目標：
1. 在同一面板支援「備會」和「記錄」兩種模式
2. 支援參考文件上傳，AI 讀取內容增強草擬品質
3. 多格式產出：.docx（必產）+ GitHub Pages HTML（可選）
4. 會議 session 持久化：一份 .md 跟著會議生命週期，支援暫存/載入
5. 個資遮蔽：對外分發的 .docx 和 HTML 自動遮蔽

---

## 設計決策摘要

| # | 決策 | 結論 |
|---|------|------|
| 1 | 備會 vs 記錄操作方式 | 同一面板雙模式切換，共用 Step 1-3 |
| 2 | 會前附件內容 | 完整議程 + 案由詳細說明 + 參考文件摘要 |
| 3 | 參考文件加入方式 | 拖曳 + 瀏覽（重用 Documents 模組的 shared 元件） |
| 4 | AI 讀取文件方式 | 只傳路徑，AI 自己用 Read tool 讀取（同 Documents 模組） |
| 5 | 輸出格式 | .docx（必產）+ GitHub Pages HTML（可選），PDF 暫不做 |
| 6 | GitHub Pages repo | `cyclone-tw/meetings`，共用 push 邏輯 |
| 7 | HTML 風格 | 報紙排版風（黑白、粗體層級、左側黑線） |
| 8 | 存檔格式 | Obsidian .md 一檔多階段（草稿 → 議程 → 完整記錄） |
| 9 | 個資遮蔽 | .md 存全名，.docx / HTML 產出時遮蔽 |
| 10 | GitHub Pages 發布 | 自動 commit + push |

---

## 雙模式面板

### 模式切換

面板 Step 1 頂部加 toggle：

```
[ 備會模式 | 記錄模式 ]
```

兩個模式共用 Step 1-3 的資料結構和 UI，差異集中在 Step 3 決議欄位和 Step 4 產出行為。

### 模式差異

| 面向 | 備會模式 | 記錄模式 |
|------|---------|---------|
| Step 1-2 | 完整填寫 | 從 .md 帶入（可編輯） |
| Step 3 案由說明 | 完整填寫 + 可上傳參考文件 | 帶入（可編輯）|
| Step 3 決議欄位 | 隱藏或標記「會後填入」 | 開放填寫 |
| Step 3 文件上傳 | 可上傳 | 沿用備會的 |
| Step 4 產出 | 會前附件（.docx + 可選 HTML） | 會議記錄（.docx + .md，Phase 1 行為） |

---

## 參考文件

### 加入方式

兩種方式並存，重用 Documents 模組的 shared 元件（`source-list.tsx`、`source-picker-modal.tsx`）：

1. **拖曳檔案/資料夾** — 拖到參考文件區，系統顯示檔案列表
2. **瀏覽選檔** — 用 `source-picker-modal` 選取本機檔案/資料夾

### 兩個層級

- **會議層級**（Step 2 附近）：通用文件，例如學期行事曆、學校概況
- **案由層級**（Step 3 各案由內）：案由專屬公文，例如交通補助申請核定函

### AI 讀取方式

只傳檔案路徑給 AI，AI 自己用 Read tool 讀取內容（同 Documents 模組設計）。AI 讀取後：
- 增強案由說明草擬品質（提取補助條件、金額、期限等）
- 產出會前附件時，嵌入參考文件摘要

---

## 會前附件內容結構

```
封面區
├── 會議名稱（○○國小 114 學年度第 5 次特殊教育推行委員會）
├── 日期、時間、地點
├── 主席、記錄
└── 出席委員名冊

議程區
├── 一、前次會議決議追蹤
├── 二、業務報告
└── 三、提案討論
    ├── 案由一
    │   ├── 案由說明（AI 草擬）
    │   ├── 涉及學生表格（遮蔽版）
    │   └── 參考文件摘要
    ├── 案由二
    └── ...
```

---

## 輸出格式

### .docx（必產）

會前附件版 .docx，含：
- 完整議程內容
- 委員簽到表空白頁
- 個資遮蔽版

### GitHub Pages HTML（可選）

- 風格：報紙排版風（黑白為主，粗體層級分明，左側黑線標記段落）
- 個資遮蔽版
- 適合螢幕閱讀和手機檢視
- 自動 commit + push 到 GitHub Pages

### PDF

暫不做。需要時從 .docx 手動轉換（macOS 預覽程式或 LibreOffice）。

---

## GitHub Pages 自動發布

### Repo 規劃

新 repo：`cyclone-tw/meetings`

```
meetings/
├── index.html          ← 自動生成的目錄頁
├── spc/
│   ├── 114-05/
│   │   └── index.html  ← 第 5 次特推會會前附件
│   ├── 114-04/
│   │   └── index.html
│   └── ...
└── iep/                ← 未來擴充
    └── ...
```

URL 格式：`https://cyclone-tw.github.io/meetings/spc/114-05/`

### 共用邏輯

從現有 `src/app/api/presentations/push-github/route.ts` 抽出共用模組：

```typescript
// src/lib/github-pages.ts
async function pushToGitHubPages(options: {
  repo: string;           // "cyclone-tw/meetings"
  folder: string;         // "spc/114-05"
  files: FileEntry[];     // [{ name: "index.html", content: "..." }]
  commitMessage: string;
  localDir?: string;      // 預設 ~/meetings-repo
}): Promise<{ url: string }>
```

簡報的 `push-github/route.ts` 改為呼叫此共用函式。

---

## Obsidian .md 生命週期

### 一檔多階段

同一份 .md 跟著會議從草稿到完成：

```
❶ 開新會議 → 建立 .md，status: "draft"
❷ 填表途中離開 → 自動暫存，status: "draft"
❸ 備會模式產出 → 更新 .md，status: "agenda-generated"
❹ 切記錄模式 → 載入同一份 .md
❺ 記錄模式產出 → 更新 .md，status: "record-generated"
```

### Frontmatter 結構

```yaml
---
type: 特推會會議
academic_year: 114
meeting_number: 5
date: "115-04-05"
time_start: "上午08:10"
location: "本校三樓共讀站"
chair: "林思遠"
recorder: "康雲昇"
status: "draft" | "agenda-generated" | "record-generated"
mode: "prep" | "record"
ref_files:
  - path: "~/Documents/公文/交通補助核定函.pdf"
    scope: "proposal-1"
  - path: "~/Documents/行事曆.docx"
    scope: "meeting"
topics: [交通補助, 專團申請]
decisions: []
tags: [特推會]
---
```

Body 用結構化 Markdown（heading + list）存內容，與 Phase 1 格式相容。

### 暫存機制

- **手動**：面板加「暫存」按鈕
- **自動**：切換 Step 時自動暫存
- 暫存寫入 Obsidian .md，不產出 .docx

### 面板載入邏輯

```
進入特推會面板
  ├─ 掃描 Obsidian 目錄，找 status != "record-generated" 的 .md
  ├─ 有未完成的？
  │   → 提示「偵測到未完成的會議：114 學年第 5 次（草稿）— 繼續 / 開新會議」
  └─ 沒有？
      → 正常開新會議
```

也可手動選擇「載入歷史會議」重新編輯已完成的會議。

---

## 個資遮蔽

### 遮蔽策略

| 輸出 | 遮蔽 | 原因 |
|------|------|------|
| Obsidian .md | 不遮蔽 | 私人筆記 + 面板還原來源 |
| .docx | 遮蔽 | 對外分發 |
| GitHub Pages HTML | 遮蔽 | 公開網路 |

### 遮蔽規則

- 三字名：中間字換○（廖祐仁 → 廖○仁）
- 二字名：第二字換○（王明 → 王○）
- 四字以上：保留首尾，中間全換○
- 住址：regex 偵測移除
- 電話：regex 偵測移除
- 障別程度、班級、公文字號：保留
- 委員姓名也同樣遮蔽

### 實作位置

- TypeScript 端：`src/lib/education/pii-mask.ts`（用於 HTML 模板）
- Python 端：`spc_meeting_core.py` 內新增遮蔽函式（用於 .docx）
- 兩端邏輯統一

---

## 檔案變更清單

### 新增

| 檔案 | 職責 |
|------|------|
| `src/lib/github-pages.ts` | 共用 GitHub Pages push 邏輯 |
| `src/lib/education/pii-mask.ts` | 個資遮蔽函式 |
| `src/lib/education/spc-session.ts` | .md 讀寫/暫存/還原邏輯 |
| `src/components/.../spc-meeting/ref-file-picker.tsx` | 參考文件拖曳/瀏覽元件 |
| `src/components/.../spc-meeting/session-loader.tsx` | 載入未完成會議 UI |
| `src/app/api/education/spc-meeting/save-draft/route.ts` | 暫存 API |
| `src/app/api/education/spc-meeting/load/route.ts` | 載入 .md API |
| `scripts/education/html_template.py` | GitHub Pages HTML 模板（風格 C） |

### 修改

| 檔案 | 變更 |
|------|------|
| `src/components/.../spc-meeting/spc-meeting-panel.tsx` | 模式切換 + 暫存 + 載入 |
| `src/components/.../spc-meeting/proposal-form.tsx` | 加參考文件上傳區 |
| `src/app/api/education/spc-meeting/generate/route.ts` | 支援備會模式產出 + HTML |
| `src/app/api/presentations/push-github/route.ts` | 改用 github-pages.ts 共用模組 |
| `scripts/education/spc_meeting_core.py` | 會前附件模板 + 遮蔽函式 |

### 不變

- Phase 1「記錄模式」行為完全不變
- 共用元件（HeaderForm, SectionEditor, DownloadPanel 等）
- 委員名冊管理
- 歷史參考功能

---

## 與其他系統的關係

- **Documents 模組**：重用 `shared/source-list.tsx`、`shared/source-picker-modal.tsx`、`/api/documents/browse`
- **簡報模組**：共用 `github-pages.ts` push 邏輯
- **Phase 1**：記錄模式完全相容，不改現有行為
- **學生資料 Spec（未來）**：StudentPicker 接口預留，未來可從 .md 載入學生資料
- **IEP 會議（未來）**：GitHub Pages repo 結構預留 `iep/` 路徑
