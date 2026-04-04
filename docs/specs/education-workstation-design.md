# 教育工作站技術設計文件

> CycloneOS Education Workstation — IEP 模組 + 課程計劃 + 教案
> 草案日期：2026-04-04

---

## 目錄

1. [架構總覽](#架構總覽)
2. [模組一：IEP 會議記錄](#模組一iep-會議記錄)
3. [模組二：IEP 服務計劃](#模組二iep-服務計劃)
4. [模組三：課程計劃](#模組三課程計劃)
5. [模組四：教案與一般文件](#模組四教案與一般文件)
6. [核心技術：模板引擎](#核心技術模板引擎)
7. [檔案結構](#檔案結構)
8. [開發順序](#開發順序)

---

## 架構總覽

```
教育工作站
├── IEP 模組
│   ├── 會議記錄模組
│   │   └── 錄音 → whisper 逐字稿 → AI 分析 → 模板填入
│   └── 服務計劃模組
│       └── 學生資料 + AI 產出個別化內容 → 模板填入
├── 課程計劃模組
│   └── 分組資訊 + 課綱 → AI 產出 → 模板填入
└── 教案/一般文件模組
    └── 範本 + 需求描述 → AI 改寫 → 新文件
```

### 與現有 Documents 工作站的核心差異

| | Documents（現行） | Education（新） |
|---|---|---|
| 核心操作 | 全文重新生成 | 模板定點填入 |
| AI 輸出 | Markdown 全文 | JSON 結構化資料 |
| 檔案處理 | markdown → 轉檔 | 讀原檔 → 定點寫入 → 保格式輸出 |
| 個資處理 | 無 | 高敏感，需隔離處理 |

---

## 模組一：IEP 會議記錄

### 使用場景

特教教師用 iPhone 錄下 IEP 會議，上傳錄音檔到 CycloneOS，系統自動產出結構化的會議記錄並填入 .doc/.docx 模板。

### 會議類型與年度循環

```
上學期初（8-9月）   上學期末（1月）    下學期初（1-2月）   下學期末（6月）
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ 期初擬定   │     │ 期末檢討   │     │ 期初擬定   │     │ 期末檢討   │
│ 確立目標   │     │ 檢討成效   │     │ 調整目標   │     │ 檢討成效   │
└──────────┘     └────┬─────┘     └────┬─────┘     └──────────┘
                       │  可合開但記錄分開  │
                       └────────────────┘
```

### 處理流程

```
Step 1: 上傳音檔
  iPhone 錄音（.m4a）上傳到指定資料夾或直接拖入 CycloneOS

Step 2: 轉逐字稿
  whisper --model base --language zh 音檔.m4a
  → 輸出逐字稿 .txt

Step 3: AI 分析（依會議類型不同 prompt）

  [期初擬定 prompt]
  從逐字稿提取：
  - 學生能力現況與需求評估
  - 本學期特教課程規劃
  - 預計之教育目標
  - 教學及支持策略
  - 行為功能分析及介入策略（有需求者）
  - 轉銜服務（有需求者）
  - 會議決議

  [期末檢討 prompt]
  從逐字稿提取：
  - 學生能力現況的改變
  - 各領域學習結果及行為處理成效
  - 下學期特殊教育需求分析
  - 下學期課程規劃調整
  - 相關服務及支持策略之調整
  - 會議決議

  → AI 輸出結構化 JSON

Step 4: 合開拆分（如適用）
  AI 從逐字稿判斷分界點（「接下來討論下學期」「現在進行期初擬定」等語句）
  → 拆成兩份獨立的 JSON

Step 5: 模板填入
  讀取 .doc/.docx 模板 → 定位欄位 → 寫入 AI 產出內容 → 保格式輸出

Step 6: 輸出
  儲存到 Google Drive 對應學生資料夾
```

### 會議記錄模板結構（從 113/114 學年度分析）

一份會議記錄檔包含整學年 4 次會議，每次會議結構：

```
南投縣 [學校] 國小 [學年度] 學年度第 [學期] 學期學生個別化教育計畫 [擬訂/檢討] 會議

Header:
  - 學生姓名
  - 會議日期
  - 地點
  - 主席
  - 記錄者

與會者簽名表:
  - 行政人員
  - 學生家長及學生
  - 普通班教師
  - 特教教師
  - 相關專業人員
  - 相關助理人員

會議紀錄:
  - 個案報告及討論事項
  - 討論內容摘要（← AI 從逐字稿產出的主要內容）

會議決議:
  - 決議事項（← AI 從逐字稿歸納）

簽名欄:
  - 家長確認簽名
  - 承辦人 / 主管 / 校長
```

### AI 輸出 JSON Schema（會議記錄）

```json
{
  "meetingType": "期初擬定" | "期末檢討",
  "semester": 1 | 2,
  "discussionItems": [
    {
      "topic": "學生能力現況",
      "content": "..."
    },
    {
      "topic": "課程規劃",
      "content": "..."
    }
  ],
  "resolutions": [
    "決議事項一...",
    "決議事項二..."
  ],
  "attendees": {
    "admin": ["從逐字稿辨識"],
    "parents": ["..."],
    "teachers": ["..."],
    "specialEdTeachers": ["..."]
  }
}
```

---

## 模組二：IEP 服務計劃

### 使用場景

依據學生個別特質，AI 協助填寫 IEP 服務計劃的各區塊，特別是：
- 學生能力現況描述
- 需求評估及支持策略
- 學年/學期教育目標
- 行為介入方案

### IEP 服務計劃模板結構（113 學年度新格式）

```
一、基本資料（手動填寫為主）
    學校、班級、安置類型、團隊成員
    學生個人資料、法定代理人、障礙類別

二、家庭狀況、發展、醫療與教育史（AI 可輔助潤飾）
    家庭簡述、健康史、教育史

三、學生能力現況及分析（AI 重點產出）
    (一) 測驗及評量資料
    (二) 現況描述 × 6 大面向（每面向含勾選 + 文字 + 策略）
         - 生活自理
         - 感官功能
         - 功能性動作
         - 語言能力
         - 學業能力
         - 社會情緒
    (三) 整體需求分析（優弱勢彙整）

四、特教服務與支持策略
    (一) 課程安排（課表）
    (二) 相關服務

五、學年/學期教育目標（AI 重點產出）
    學年目標 → 學期目標 → 評量方式

六、行為介入方案（有需求者）

七、轉銜輔導及服務
```

### AI 角色

| 區塊 | AI 能做的 | 需要人工的 |
|------|---------|----------|
| 基本資料 | 從既有資料帶入 | 確認正確性 |
| 能力現況描述 | 依據評量結果和觀察產出文字描述 | 確認符合實際 |
| 需求評估 | 依能力現況建議勾選項和策略 | 教師專業判斷 |
| 教育目標 | 依能力現況和課綱產出目標草稿 | 調整適切性 |
| 行為介入 | 依行為描述建議介入策略 | 確認可行性 |

---

## 模組三：課程計劃

### 使用場景

特教教師依分組別產出學年度課程計劃，通常一個組別一份，半通用性質。

### 處理流程

```
輸入：
  - 分組資訊（年級、障礙類別、人數）
  - 課綱參考（十二年國教各領綱）
  - 既有課程計劃範本

AI 處理：
  - 依學生組別特質調整課程內容
  - 產出符合課綱的學習目標
  - 安排學期進度

輸出：
  - 填入課程計劃模板（.docx）
```

---

## 模組四：教案與一般文件

### 使用場景

提供範本 → 依需求改寫。無個資，最通用。

### 處理流程

```
輸入：
  - 範本檔案（.doc/.docx）
  - 改寫需求描述

AI 處理：
  - 讀取範本內容
  - 依需求改寫（可較自由調整格式）

輸出：
  - 新的 .docx 檔案
```

---

## 核心技術：模板引擎

### 方案選擇

| 方案 | 優點 | 缺點 |
|------|------|------|
| **docxtemplater** (Node.js) | 佔位符替換、支援表格循環、社群活躍 | 需先在模板加 `{tag}`，.doc 需先轉 .docx |
| **python-docx** (Python) | 對表格操作穩定、可精確定位段落 | 需跨語言呼叫 |
| **mammoth** (Node.js) | 讀取 .docx 結構 | 主要做轉換不做修改 |
| **officegen** (Node.js) | 可生成 .docx | 不能讀取既有檔案 |

**建議方案：docxtemplater**

理由：
1. 原生 Node.js，與 CycloneOS（Next.js）技術棧一致
2. 支援條件邏輯（勾選框）、表格循環（多筆資料）
3. 有 image module 可插入圖片
4. 支援 .docx（你的 .doc 檔需一次性轉檔為 .docx 模板）

### 模板準備流程

```
現有 .doc 模板
    ↓ 一次性轉換
.docx 模板 + 加入佔位符
    ↓ 例如：
    {學生姓名} {會議日期} {障礙類別}
    {#討論事項}{content}{/討論事項}
    {#決議}{text}{/決議}
    ↓
存為「教育工作站標準模板」
```

### 技術架構

```
src/lib/education/
├── template-engine.ts      # docxtemplater 包裝層
│   ├── loadTemplate(path)  # 讀取 .docx 模板
│   ├── fillTemplate(data)  # 填入 JSON 資料
│   └── saveDocument(path)  # 輸出 .docx（保留格式）
│
├── whisper-transcriber.ts  # 音檔 → 逐字稿
│   ├── transcribe(audioPath, lang)
│   └── detectMeetingSplit(transcript)  # 偵測合開分界點
│
├── meeting-analyzer.ts     # 逐字稿 → 結構化 JSON
│   ├── analyzeInitialMeeting(transcript)   # 期初
│   ├── analyzeReviewMeeting(transcript)    # 期末
│   └── splitCombinedMeeting(transcript)    # 合開拆分
│
├── iep-generator.ts        # IEP 服務計劃產出
│   ├── generateAbilityDescription(studentData)
│   ├── generateGoals(needs, curriculum)
│   └── generateBehaviorPlan(behaviorData)
│
├── curriculum-generator.ts # 課程計劃產出
│
├── templates/              # .docx 標準模板
│   ├── iep-meeting-initial.docx    # 期初擬定會議模板
│   ├── iep-meeting-review.docx     # 期末檢討會議模板
│   ├── iep-plan.docx               # IEP 服務計劃模板
│   ├── curriculum-plan.docx        # 課程計劃模板
│   └── lesson-plan.docx            # 教案模板
│
└── prompts/                # AI Prompt 模板
    ├── meeting-initial.md
    ├── meeting-review.md
    ├── meeting-split.md
    ├── ability-description.md
    └── goal-generation.md

src/app/api/education/
├── transcribe/route.ts     # POST: 音檔上傳 → 逐字稿
├── analyze/route.ts        # POST: 逐字稿 → 結構化分析
├── generate/route.ts       # POST: 產出文件
└── templates/route.ts      # GET: 列出可用模板

src/components/skills/workstations/education/
├── education-workstation.tsx       # 主界面
├── iep-meeting-panel.tsx           # IEP 會議記錄面板
├── iep-plan-panel.tsx              # IEP 服務計劃面板
├── curriculum-panel.tsx            # 課程計劃面板
├── lesson-plan-panel.tsx           # 教案面板
├── audio-upload.tsx                # 音檔上傳元件
├── transcript-viewer.tsx           # 逐字稿預覽/編輯
├── template-selector.tsx           # 模板選擇器
└── document-preview.tsx            # 成品預覽
```

---

## 個資安全

| 原則 | 實作 |
|------|------|
| 資料不離機 | 所有處理在本機，不上傳雲端 AI API |
| 使用 Claude Code / Codex CLI | 走訂閱制，不經第三方 API |
| 輸出存 Google Drive 學校帳號 | 依既有資料夾結構存放 |
| AI 不記憶個資 | 每次 session 獨立，不跨學生保留 context |
| 模板與資料分離 | 模板在 repo，學生資料在 Google Drive |

---

## 開發順序

### Phase 1：核心基礎（模板引擎 + 音檔轉寫）
1. 安裝 docxtemplater，建立 template-engine.ts
2. 將現有 .doc 模板轉為 .docx 並加入佔位符
3. 整合 whisper 轉逐字稿 pipeline
4. 建立基本 UI（音檔上傳 + 逐字稿預覽）

### Phase 2：IEP 會議記錄自動化
5. 實作 meeting-analyzer.ts（期初 + 期末 prompt）
6. 實作合開拆分邏輯
7. 串接模板引擎 → 輸出 .docx
8. UI：會議類型選擇 + 模板選擇 + 預覽

### Phase 3：IEP 服務計劃
9. 實作 iep-generator.ts
10. 能力現況描述自動產出
11. 教育目標草稿產出
12. 行為介入方案

### Phase 4：課程計劃 + 教案
13. curriculum-generator.ts
14. 教案改寫功能
15. 批次處理（多組別一次產出）

---

## 法規依據與最佳實踐

### 特教法規要求

| 法規 | 重點 |
|------|------|
| 特殊教育法 §31 | 以團隊合作方式訂定 IEP，**應邀請學生本人參與**（113 年修法重點） |
| 施行細則 §10 | IEP 應包含：能力現況、特教服務、學年/學期目標、行為介入、轉銜服務 |
| 施行細則 §11 | 舊生：開學**前**訂定；新生/轉學生：入學後 **1 個月內**；每學期**至少檢討一次** |
| 會議文件 | 決議內容應於會議後 **2 週內**提供予學生及家長 |

### IEP 會議應討論事項（依法規與最佳實踐）

**期初擬定：**
1. 學生能力現況報告（認知、溝通、行動、情緒、感官、健康、自理、學科）
2. 特教服務與課程安排（抽離/外加/免修 — 需經 IEP 會議討論）
3. 學年/學期教育目標（具體可測量）
4. 相關服務及支持策略（專團、輔具、行政支援）
5. 行為功能介入方案（有需求者）
6. 轉銜服務（跨教育階段/跨學習階段必填）

**期末檢討：**
1. 學生能力現況的**改變**
2. 各領域學習結果及行為處理**成效**
3. 學期目標**達成情形**（達成率）
4. 教學策略及服務**成效評估**
5. 下學期課程規劃建議
6. 是否需要**調整**長期（學年）目標

### 會議品質提升建議（研究文獻摘要）

- 教師應事先觀察學生生活適應及學習適應困難
- 學生參與前應先教導會議流程和自我倡議技巧（CRPD 精神）
- 行動方案格式：「**任務 + 負責夥伴 + 期限**」
- 針對教學活動討論具體的**頻率、時間、次數、融入科目及方式**

### 參考資源

- [教育部全國特教資訊網 — IEP 專區](https://special.moe.gov.tw/article.php?paid=140)
- [南投縣特教資源中心 — IEP 格式](http://spec.ntct.edu.tw/FileUploadCategoryListC004530.aspx?CategoryID=5dc851fe-210a-408e-ad72-e85d7c4c5c41)
- [臺北市教育局 — 學生參與 IEP 會議手冊](https://www.doe.gov.taipei/News_Content.aspx?n=EBF06CB23AA475A5&s=B0B5A7D33C566613)
- 本校既有敘寫說明：`02.IEP/112學年度IEP/IEP新格式/04-南投縣學生個別化教育計畫（IEP）會議敘寫說明.pdf`

---

## 待確認事項

1. [ ] 模板轉換：你願意把現有 .doc 統一轉成 .docx 嗎？（docxtemplater 需要 .docx）
2. [ ] 佔位符設計：需要你一起確認每份模板的佔位符位置
3. [ ] 學生資料來源：目前都在 Google Drive？還是有些在 Notion 或其他系統？
4. [ ] whisper 模型大小：base（快但較粗）vs medium（慢但較準），你的 M4 跑 medium 應該沒問題
5. [ ] 第一份模板：從哪個開始做？建議先做**會議記錄**，因為你手邊有 .m4a 錄音檔可以馬上測試
