# 會議記錄工作站 UI 設計文件

> CycloneOS Education Workstation — 會議記錄模組（IEP + 特推會）
> 日期：2026-04-05

---

## 背景

教育工作站需要整合兩種會議記錄 pipeline：

1. **IEP 會議記錄**（語音導向）：錄音檔 → whisper 逐字稿 → AI 分析 → .docx
2. **特推會會議記錄**（任務導向）：填表單 → AI 草擬 → 預覽/編輯 → .docx + .md

兩者操作流程截然不同，但有共用的預覽、編輯、下載需求。

### 相關文件

- IEP 會議記錄設計：`docs/specs/education-workstation-design.md`
- 特推會會議記錄設計：`docs/superpowers/specs/2026-04-05-spc-meeting-generator-design.md`
- 學生資料檔結構：另開 Spec（本文件預留接口）

---

## 設計決策摘要

| # | 決策 | 結論 |
|---|------|------|
| 1 | 放置位置 | 教育工作站的子模組（非獨立工作站） |
| 2 | IEP vs 特推會面板 | 完全獨立面板，共用元件 |
| 3 | 歷史參考呈現 | 可展開參考區 + 前次決議自動帶入 |
| 4 | 學生資料 | 另開 spec，本 spec 預留 StudentPicker 接口 |
| 5 | 合開拆分 | AI 自動偵測 + 可手動標記 |
| 6 | 拆分預覽 | Tab 切換（期末/期初） |
| 7 | 編輯模式 | 混合：Header 結構化表單 + 內文 textarea |
| 8 | 通用化範圍 | 前端元件通用化，Python 端各自維護 |
| 9 | 委員名冊 | per 學年度 .md 檔，存 Obsidian，可載入/切換 |

---

## 架構總覽

### 教育工作站入口頁

進入教育工作站後顯示子模組選單：

```
🎓 教育工作站
┌─────────────┐  ┌─────────────┐
│ 📋 IEP 會議  │  │ 📋 特推會會議 │
│  錄音→記錄   │  │  填表→記錄   │
└─────────────┘  └─────────────┘
┌─────────────┐  ┌─────────────┐
│ 📝 IEP 計劃  │  │ 📚 課程計劃  │
│   即將推出    │  │   即將推出   │
└─────────────┘  └─────────────┘
```

點選子模組後進入對應面板，面板頂部有返回按鈕回到此選單。

---

## IEP 會議記錄面板

### 操作流程（四步驟）

```
Step 1: 輸入
┌──────────────────────────────────┐
│ [期初擬定 ▼] [期末檢討] [合開]    │  ← MeetingTypePicker
│                                  │
│ ┌──────────────────────────────┐ │
│ │  拖曳音檔到此處上傳            │ │  ← AudioUploader
│ │  或點擊選擇檔案 (.m4a)        │ │
│ └──────────────────────────────┘ │
│                                  │
│ 學生姓名：[         ]            │  ← StudentPicker（預留）
│ 會議日期：[         ]            │    預設讀音檔建立日期
│                                  │
│ ☐ 這是合開會議（AI 也會自動偵測） │  ← 手動標記
│                                  │
│          [開始處理]               │
└──────────────────────────────────┘

Step 2: AI 處理
┌──────────────────────────────────┐
│ ● whisper 轉錄中... 43%          │  ← WhisperProgress
│ ████████████░░░░░░░░ 4:32/10:15  │
│                                  │
│ ○ AI 分析                        │
│ ○ 生成文件                       │
└──────────────────────────────────┘

Step 3: 預覽 + 編輯
┌──────────────────────────────────┐
│ [期末檢討] [期初擬定]             │  ← SplitTabs（合開時顯示）
│                                  │
│ ── Header ──                     │  ← MeetingHeaderForm
│ 學生姓名：[王○明    ]            │
│ 會議日期：[115年3月27日]          │
│ 地    點：[本校三樓共讀站]        │
│ 主    席：[○○○    ]            │
│ 記    錄：[○○○    ]            │
│                                  │
│ ── 討論內容摘要 ──               │  ← MeetingSectionEditor
│ ┌──────────────────────────────┐ │
│ │ 一、學生能力現況               │ │
│ │ 王生本學期在認知學習方面...     │ │
│ │                              │ │  ← textarea，可直接編輯
│ └──────────────────────────────┘ │
│                                  │
│ ── 會議決議 ──                   │  ← MeetingSectionEditor
│ ┌──────────────────────────────┐ │
│ │ 1. 維持現行特教服務安排...     │ │
│ │ 2. 下學期增加...              │ │  ← textarea，可直接編輯
│ └──────────────────────────────┘ │
│                                  │
│ 簽到表：留空（現場簽名）          │
└──────────────────────────────────┘

Step 4: 確認 + 下載
┌──────────────────────────────────┐
│ [下載 .docx]  [存逐字稿到 Obsidian]│ ← DownloadPanel
│                                  │
│ ✅ 已生成：王○明-期末檢討.docx    │
│ ✅ 逐字稿已存：Obsidian/...       │
└──────────────────────────────────┘
```

### 合開拆分邏輯

1. 使用者上傳音檔，可選擇手動標記「這是合開會議」
2. 若未手動標記，AI 分析逐字稿時自動偵測分界點
3. 若偵測為合開 → 拆成兩份，Step 3 出現 tab 切換
4. 若偵測為單場 → 正常單份流程
5. 使用者在 Step 3 可以切換 tab 逐份編輯，各自獨立下載

### whisper 進度

透過 polling（與現有 transcribe-workstation 相同模式）：
- 前端每 2 秒 poll `/api/education/iep-meeting/transcribe?jobId=xxx`
- 後端回傳進度百分比 + 目前步驟

---

## 特推會會議記錄面板

### 操作流程

```
Step 1: 基本資訊
┌──────────────────────────────────┐
│ 學年度：[114]  第 [5] 次會議      │
│ 日  期：[115年4月5日]             │
│ 時  間：[上午08:10]              │
│ 地  點：[本校三樓共讀站]          │
│                                  │
│ 委員名冊：114 學年度 (12人) [管理] │ ← CommitteeManager 入口
│ 主  席：[○○○ ▼]  從名冊選      │
│ 記  錄：[○○○ ▼]  從名冊選      │
└──────────────────────────────────┘

Step 2: 前次決議 + 業務報告
┌──────────────────────────────────┐
│ ── 前次會議決議追蹤 ──            │  ← PreviousDecisions
│ ┌──────────────────────────────┐ │
│ │ （自動從 114-特推會-04 帶入）   │ │
│ │ 經委員會討論後，通過以下...     │ │  ← 自動帶入，可編輯
│ └──────────────────────────────┘ │
│                                  │
│ ── 業務報告 ──                   │  ← BusinessReportEditor
│ ┌──────────────────────────────┐ │
│ │ 本學期資源班重要行事...        │ │  ← textarea
│ └──────────────────────────────┘ │
└──────────────────────────────────┘

Step 3: 提案（可多筆）
┌──────────────────────────────────┐
│ 案由 1                    [+案由] │
│                                  │
│ 案由類型：[交通補助 ▼]            │  ← ProposalForm
│ 涉及學生：                       │  ← StudentPicker（預留）
│   ┌──────┬─────┬────────┬─────┐ │
│   │ 姓名  │ 班級 │ 障別程度 │ 備註│ │  ← 動態表格
│   ├──────┼─────┼────────┼─────┤ │
│   │王小明 │四甲  │中度智障  │祖父 │ │
│   │李小華 │三甲  │輕度智障  │祖母 │ │
│   └──────┴─────┴────────┴─────┘ │
│   [+ 新增學生]                   │
│                                  │
│ 公文字號：[                    ]  │
│                                  │
│ ▶ 查看歷史參考（找到 5 份同類）    │  ← HistoryReference（展開區）
│                                  │
│        [AI 草擬說明]              │
│                                  │
│ ── AI 草擬結果 ──                │
│ 【案由】為四甲王○明、三甲李○華... │
│ 【說明】                         │
│ ┌──────────────────────────────┐ │
│ │ 四甲王生領有第一類中度...       │ │  ← textarea，可編輯
│ └──────────────────────────────┘ │
│ 【決議】                         │
│ ┌──────────────────────────────┐ │
│ │ （會後填入）                   │ │  ← textarea
│ └──────────────────────────────┘ │
│                                  │
│ [重新生成] [確認此案由]           │
├──────────────────────────────────┤
│ 案由 2                           │
│ ...（同上結構，可摺疊）           │
└──────────────────────────────────┘

Step 4: 確認 + 下載
┌──────────────────────────────────┐
│ 臨時動議：[無                  ]  │
│ 散會時間：[上午09:00            ]  │
│                                  │
│ [預覽完整會議記錄]                │  ← MeetingPreview
│ [下載 .docx]  [存 .md 到 Obsidian]│ ← DownloadPanel
│                                  │
│ ✅ .docx → ~/Desktop/114-第5次... │
│ ✅ .md  → Obsidian/02-特教/...   │
│ ✅ MOC 已更新                    │
└──────────────────────────────────┘
```

### 委員名冊管理（CommitteeManager）

點擊基本資訊區的「管理」按鈕，彈出管理介面：

```
┌─ 委員名冊管理 ──────────────────┐
│                                  │
│ 學年度：[114 ▼]                  │
│                                  │
│ ┌──┬──────────┬─────┬─────┬───┐ │
│ │# │ 職稱      │ 姓名 │ 身份 │ ✕ │ │
│ ├──┼──────────┼─────┼─────┼───┤ │
│ │1 │ 校長      │○○○│ 主席 │ ✕ │ │
│ │2 │ 教導主任   │○○○ │ 委員 │ ✕ │ │
│ │3 │ 資源班教師 │○○○│記錄  │ ✕ │ │
│ │..│          │     │     │   │ │
│ └──┴──────────┴─────┴─────┴───┘ │
│ [+ 新增委員]                     │
│                                  │
│ [從上學年複製]  [儲存]  [取消]    │
└──────────────────────────────────┘
```

- 儲存後寫入 Obsidian `02-特教業務/特推會/委員名冊/{year}-特推會委員名冊.md`
- 「從上學年複製」讀取前一年名冊，複製到新學年度供修改
- 主席/記錄從名冊選取，自動帶入基本資訊欄位

### 歷史參考（HistoryReference）

展開後顯示：

```
▼ 查看歷史參考（找到 5 份同類）
┌──────────────────────────────────┐
│ 📄 114-01 交通補助（114年8月29日）│
│   說明：四甲王生領有第一類中度...  │
│                                  │
│ 📄 113-04 交通補助（114年2月25日）│
│   說明：三甲李生領有第一類輕度...  │
│                                  │
│ 📄 113-01 交通補助（113年9月11日）│
│   說明：...                      │
│                                  │
│ 顯示更多 (2)                     │
└──────────────────────────────────┘
```

---

## 共用元件設計

### 元件與使用場景

| 元件 | 職責 | 設定方式 |
|------|------|---------|
| `MeetingHeaderForm` | 渲染結構化 Header 欄位 | 傳入欄位定義陣列 `FieldDef[]` |
| `MeetingSectionEditor` | 渲染內文區塊 textarea | 傳入區塊定義 `{label, key, placeholder}` |
| `MeetingPreview` | 整合 Header + Sections 唯讀預覽 | 傳入完整 meeting data |
| `HistoryReference` | 可展開的歷史會議參考 | 傳入 `{records, isOpen}` |
| `DownloadPanel` | 下載 .docx / .md | 傳入 `{docxUrl, mdPath}` |
| `StudentPicker` | 選取/輸入學生資料 | 預留接口，短期為手動輸入表格 |

### FieldDef 結構

```typescript
interface FieldDef {
  key: string;           // 欄位 key
  label: string;         // 顯示標籤
  type: 'text' | 'date' | 'time' | 'select';
  defaultValue?: string;
  options?: string[];    // type=select 時的選項
  readOnly?: boolean;
}
```

### IEP 會議的 Header 欄位

```typescript
const iepHeaderFields: FieldDef[] = [
  { key: 'studentName', label: '學生姓名', type: 'text' },
  { key: 'meetingDate', label: '會議日期', type: 'date' },
  { key: 'location', label: '地點', type: 'text', defaultValue: '本校三樓共讀站' },
  { key: 'chair', label: '主席', type: 'text', defaultValue: '○○○' },
  { key: 'recorder', label: '記錄', type: 'text', defaultValue: '○○○' },
];
```

### 特推會的 Header 欄位

```typescript
const spcHeaderFields: FieldDef[] = [
  { key: 'academicYear', label: '學年度', type: 'text', defaultValue: '114' },
  { key: 'meetingNumber', label: '第幾次', type: 'text' },
  { key: 'meetingDate', label: '會議日期', type: 'date' },
  { key: 'timeStart', label: '開始時間', type: 'time', defaultValue: '上午08:10' },
  { key: 'location', label: '地點', type: 'text', defaultValue: '本校三樓共讀站' },
  { key: 'chair', label: '主席', type: 'select' },     // 從委員名冊載入
  { key: 'recorder', label: '記錄', type: 'select' },   // 從委員名冊載入
];
```

---

## Obsidian 檔案路徑規劃

### 特推會相關

```
Obsidian-Cyclone/02-特教業務/
├── 特推會/
│   ├── moc-特推會.md                        ← 已存在，新會議自動追加
│   ├── {year}-特推會-{NN}-{topic}.md        ← 已存在 26 份 + 新生成
│   └── 委員名冊/                            ← 新增
│       ├── 114-特推會委員名冊.md
│       ├── 113-特推會委員名冊.md             ← 可從歷史會議反推建立
│       └── ...
```

### 委員名冊 .md 格式

```yaml
---
type: 特推會委員名冊
academic_year: 114
updated: "115-04-05"
tags: [特推會, 委員名冊]
---

| 序號 | 職稱 | 姓名 | 身份 | 備註 |
|------|------|------|------|------|
| 1 | 校長 | ○○○ | 主席 | |
| 2 | 教導主任 | ○○○ | 委員 | |
| 3 | 資源班教師 | ○○○ | 委員/記錄 | |
| ... | | | | |
```

### IEP 會議記錄輸出

```
~/Desktop/
└── {date}-{studentName}-{meetingType}.docx    ← .docx 輸出到桌面

Obsidian-Cyclone/02-特教業務/IEP/逐字稿/
└── {date}-{studentName}-{meetingType}.md      ← 逐字稿存 Obsidian
```

輸出路徑與現有 `iep_pipeline.py` 行為一致。

### 未來預留

```
Obsidian-Cyclone/02-特教業務/
├── 學生資料/                    ← Spec A：學生個別 .md
│   ├── 王○明.md
│   └── ...
└── 相關服務/                    ← 未來擴充
```

---

## API 路由

### IEP 會議記錄

```
POST /api/education/iep-meeting/transcribe
  body: FormData { audio: File, meetingType, studentName, date }
  response: { jobId }

GET  /api/education/iep-meeting/transcribe?jobId=xxx
  response: { status, progress, step, result? }

POST /api/education/iep-meeting/analyze
  body: { transcript, meetingType, isCombined? }
  response: { meetings: MeetingData[] }
  （合開時 meetings 有兩筆，單場一筆）

POST /api/education/iep-meeting/generate
  body: { meetingData: MeetingData }（經使用者編輯後的最終資料）
  response: { docxUrl, transcriptPath }
```

### 特推會會議記錄

```
POST /api/education/spc-meeting/draft
  body: { proposalType, students, refDoc }
  response: { title, description }

GET  /api/education/spc-meeting/history?type=交通補助&limit=5
  response: { records: HistoryRecord[] }

POST /api/education/spc-meeting/generate
  body: MeetingRecord（完整會議資料，經使用者編輯）
  response: { docxUrl, mdPath, mocUpdated }
```

### 委員名冊

```
GET  /api/education/committee?year=114
  response: { members: CommitteeMember[], year }

PUT  /api/education/committee
  body: { year, members: CommitteeMember[] }
  response: { saved: true, path }

POST /api/education/committee/copy
  body: { fromYear: 113, toYear: 114 }
  response: { saved: true, members }
```

---

## CycloneOS 檔案結構

### 前端元件

```
src/components/skills/workstations/education/
├── education-workstation.tsx            ← 入口頁（子模組卡片選單）
│
├── iep-meeting/
│   ├── iep-meeting-panel.tsx            ← 主面板（四步驟流程）
│   ├── audio-uploader.tsx               ← 音檔拖曳上傳
│   ├── whisper-progress.tsx             ← whisper 轉錄進度條
│   ├── meeting-type-picker.tsx          ← 期初/期末/合開選擇
│   └── split-tabs.tsx                   ← 合開拆分 tab 切換
│
├── spc-meeting/
│   ├── spc-meeting-panel.tsx            ← 主面板（四步驟流程）
│   ├── proposal-form.tsx                ← 案由類型 + 學生 + 公文
│   ├── business-report-editor.tsx       ← 業務報告 textarea
│   ├── previous-decisions.tsx           ← 前次決議自動帶入
│   └── committee-manager.tsx            ← 委員名冊管理 modal
│
└── shared/
    ├── meeting-header-form.tsx           ← 結構化 Header 表單
    ├── meeting-section-editor.tsx        ← 內文區塊 textarea
    ├── meeting-preview.tsx               ← 整合預覽（唯讀）
    ├── history-reference.tsx             ← 可展開歷史參考
    ├── download-panel.tsx                ← .docx/.md 下載
    └── student-picker.tsx                ← 學生選擇（預留接口）
```

### API 路由

```
src/app/api/education/
├── iep-meeting/
│   ├── transcribe/route.ts
│   ├── analyze/route.ts
│   └── generate/route.ts
│
├── spc-meeting/
│   ├── draft/route.ts
│   ├── history/route.ts
│   └── generate/route.ts
│
└── committee/
    ├── route.ts                          ← GET / PUT
    └── copy/route.ts                     ← POST 從上學年複製
```

### Python 腳本（已存在，不變動）

```
scripts/education/
├── iep_pipeline.py                       ← IEP 一鍵 pipeline
├── iep_meeting_generator.py              ← python-docx 生成 .docx
├── iep_batch.py                          ← 批次處理
├── spc_meeting_core.py                   ← 特推會核心邏輯
├── spc_meeting_cli.py                    ← 特推會互動 CLI
├── convert_spc_meetings.py               ← 歷史轉換（已完成）
└── docx_utils.py                         ← 共用 docx helpers
```

API route 透過 `child_process` 或 `execa` 呼叫 Python 腳本，保持 Python 端獨立。

---

## 狀態管理

### IEP 會議面板

使用 React `useState` 管理本地狀態（與 transcribe-workstation 模式一致）：

- `currentStep`: 1-4
- `activeJob`: whisper 任務狀態（polling）
- `meetingType`: 期初 / 期末 / 合開
- `isCombined`: boolean（AI 偵測 or 手動標記）
- `meetings`: MeetingData[]（一份或兩份）
- `activeTab`: 合開時的 tab index

### 特推會面板

使用 React `useState`：

- `currentStep`: 1-4
- `headerData`: 基本資訊
- `previousDecisions`: 前次決議文字
- `businessReport`: 業務報告
- `proposals`: Proposal[]（多筆案由）
- `committee`: CommitteeMember[]（從名冊載入）

兩者都不需要 Zustand store，因為不跨元件共享複雜狀態。

---

## 與未來系統的接口

### 學生資料（Spec A）

`StudentPicker` 元件預留 props：

```typescript
interface StudentPickerProps {
  value: StudentInfo[];
  onChange: (students: StudentInfo[]) => void;
  // 未來：從學生 .md 載入
  // dataSource?: 'manual' | 'obsidian';
}

interface StudentInfo {
  name: string;
  className: string;       // 班級
  disability: string;      // 障別程度
  detail?: string;         // 補充資訊
}
```

短期：手動輸入表格（姓名、班級、障別、備註）
長期：從學生個別 .md 檔載入，自動帶入欄位

### 其他教育模組

教育工作站入口頁的子模組卡片設計為可擴充：

```typescript
interface SubModule {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: 'active' | 'coming-soon';
  component?: React.ComponentType;
}
```

新增模組只需加入 config + 對應 panel 元件。
