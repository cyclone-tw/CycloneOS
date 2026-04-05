# 特推會會議記錄產生器 設計文件

> CycloneOS Education Workstation — 特推會模組
> 日期：2026-04-05

---

## 背景與目的

特推會（特殊教育推行委員會）是校級委員會，由公文驅動召開，討論特教相關申請與審議事項。目前會議記錄由特教業務承辦人（使用者）手動撰寫 .doc 檔。

本工具目標：**半自動化產出特推會會議記錄**。使用者輸入案由類型與關鍵資訊，AI 參考歷次同類會議草擬「說明」段落，產出 .docx（送印）和 .md（Obsidian 存檔）。

### 與 IEP 會議記錄的差異

| | IEP 會議記錄 | 特推會會議記錄 |
|---|---|---|
| 觸發方式 | 學期固定（期初/期末） | 公文驅動，不定期 |
| 會議對象 | 個別學生 | 全校特教業務 |
| 輸入來源 | 錄音檔（whisper 轉逐字稿） | 承辦人手動輸入關鍵資訊 |
| AI 角色 | 從逐字稿提取結構化內容 | 參考歷史會議，草擬正式說明文字 |
| 批次需求 | 高（多個學生） | 低（一次一會） |

---

## 常見案由類型

從 110-114 學年度 25 份歷史會議記錄分析，歸納出 7 類常見案由：

| 類型 | 頻率 | 說明複雜度 | 典型輸入 |
|---|---|---|---|
| `交通補助` | 每學期 1-2 次 | 低 | 學生、障別、接送人 |
| `專團申請` | 每學期 1 次 | 高 | 學生現況、需求項目、預期助益、服務排序 |
| `助理員申請` | 每學期 1 次 | 高 | 學生現況、需求說明 |
| `酌減學生數` | 每學年 1 次 | 中 | 學生名冊、公文依據 |
| `轉安置` | 不定期 | 中 | 學生現況、安置建議 |
| `課程計畫審議` | 每學年 1 次 | 低 | 制式審查項目 |
| `其他` | 不定期 | 不定 | 自由輸入 |

---

## 架構

```
scripts/education/
├── spc_meeting_core.py        ← 核心邏輯（CLI 和 API 共用）
│   ├── fetch_similar_meetings()   讀歷史 .md 找同類會議
│   ├── draft_proposal()           呼叫 LLM 草擬說明段落
│   ├── generate_docx()            python-docx 產出 .docx
│   └── save_markdown()            存 .md 到 Obsidian
│
├── spc_meeting_cli.py         ← 介面 1：互動式 CLI
│
└── convert_spc_meetings.py    ← 已完成：歷史記錄批次轉 .md

src/app/api/education/
└── spc-meeting/route.ts       ← 介面 2：Dashboard API（後續）

src/components/skills/workstations/education/
└── spc-meeting-panel.tsx      ← 介面 2：Dashboard 前端（後續）
```

### AI Agent 無關性

唯一依賴 AI 的環節是 `draft_proposal()`。此函式：

1. 組裝 prompt（案由類型 + 學生資訊 + 歷史參考）
2. 呼叫 LLM CLI（claude → codex → 可擴充）
3. 回傳結構化 JSON

```python
def call_llm(prompt: str) -> str:
    """呼叫 LLM，自動 fallback。與 iep_pipeline.py 共用邏輯。"""
    for cmd in [
        ["claude", "-p"],
        ["codex", "--quiet", "--full-auto"],
    ]:
        result = subprocess.run(cmd, input=prompt, capture_output=True, text=True)
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()
    raise RuntimeError("所有 LLM provider 皆失敗")
```

支援 `--skip-ai` 模式：使用者直接提供完整內容 JSON，跳過 AI 草擬。

---

## 會議記錄結構（.docx 輸出格式）

依據歷年實際格式與南投縣範本：

```
南投縣○○國民小學 {學年度} 學年度特殊教育推行委員會
第 {N} 次會議紀錄

壹、會議時間：{日期}（星期{X}）{時間}
貳、會議地點：{地點}
參、主席：{主席}　　　　記錄：{記錄}
肆、出席人員：如會議簽到簿
伍、會議議程
  一、主席致詞：（略）
  二、資源班業務報告：{業務報告}
  三、前次會議決議追蹤：{追蹤內容}    ← AI 自動從上次會議 .md 帶入
  四、提案討論：
    【案由一】{案由標題}
    【說  明】{AI 草擬 + 使用者修改}
    【決  議】{會後填入或 AI 預填}
    ...可多個案由
陸、臨時動議：無
柒、散會：{時間}

承辦人：　　　單位主管：　　　校長：

──── 簽到表 ────
{委員名單表格，簽到欄留空}
```

---

## 核心模組 spc_meeting_core.py

### 資料結構

```python
@dataclass
class Proposal:
    """一個提案。"""
    type: str               # 案由類型：交通補助, 專團申請, ...
    title: str              # 案由標題
    description: str        # 說明（AI 草擬或手動輸入）
    decision: str           # 決議（預設空，會後填入）
    students: list[dict]    # 涉及學生 [{name, disability, detail}, ...]
    ref_doc: str            # 相關公文字號

@dataclass
class MeetingRecord:
    """完整會議記錄。"""
    academic_year: int      # 學年度
    meeting_number: int     # 第幾次
    date: str               # 會議日期
    weekday: str            # 星期幾
    time_start: str         # 開始時間
    time_end: str           # 散會時間（會後填）
    location: str           # 地點
    chair: str              # 主席
    recorder: str           # 記錄
    business_report: str    # 業務報告
    previous_tracking: str  # 前次決議追蹤
    proposals: list[Proposal]
    motions: str            # 臨時動議
    committee: list[dict]   # 委員名單 [{title, role, name}, ...]
```

### 函式設計

#### fetch_similar_meetings(proposal_type, n=3) → list[str]

從 `Obsidian-Cyclone/02-特教業務/特推會/` 讀取歷史 .md，找出同類型案由的會議記錄，回傳最近 n 份的說明段落作為 AI 參考。

匹配邏輯：
- 讀每份 .md 的 frontmatter `topics` 欄位
- 用關鍵字比對案由類型（交通補助 → topics 含「交通補助」）
- 按學年度降序排列，取最近 n 份

#### draft_proposal(proposal_type, students, ref_doc, similar_records) → str

組裝 prompt 呼叫 LLM，草擬案由的「說明」段落。

Prompt 結構：
```
你是國小特教業務承辦人，正在撰寫特推會會議記錄。

## 案由類型
{proposal_type}

## 本次學生資訊
{students 的詳細資料}

## 相關公文
{ref_doc}

## 歷次同類會議的說明段落（供參考格式和用語）
{similar_records}

## 任務
根據以上資訊，草擬本次案由的「說明」段落。
- 使用正式公文用語
- 參考歷次會議的格式和結構
- 學生姓名中間字用○代替
- 引用公文字號時完整引述
- 繁體中文

只輸出說明段落的文字，不需要 JSON 包裝。
```

#### fetch_previous_decisions(academic_year, meeting_number) → str

讀取前一次會議的決議，自動填入「前次會議決議追蹤」。

邏輯：找 `{year}-特推會-{N-1:02d}-*.md`，提取 `## 提案討論` 下的 `**決議：**` 段落。

#### generate_docx(record: MeetingRecord, output_path: str)

用 python-docx 從零生成 .docx，格式與現有 `iep_meeting_generator.py` 一致：
- A4 頁面，標楷體 10pt 內文，14pt 標題
- 簽到表：從委員名單生成，簽到欄留空
- 核章欄：承辦人 / 單位主管 / 校長

#### save_markdown(record: MeetingRecord, obsidian_path: str)

將會議記錄存為 .md，格式與 `convert_spc_meetings.py` 產出的一致：
- frontmatter（type, academic_year, meeting_number, date, topics, decisions, tags）
- 結構化 Markdown 正文

同時更新 `MOC-特推會.md` 索引。

---

## 互動式 CLI（spc_meeting_cli.py）

### 操作流程

```
$ python3 spc_meeting_cli.py

📋 特推會會議記錄產生器
━━━━━━━━━━━━━━━━━━━━━

[基本資訊]
學年度 (114)：
第幾次會議：5
會議日期 (115年4月5日)：
會議時間 (上午08:10)：
地點 (本校三樓共讀站)：

[前次會議決議追蹤]
  自動讀取 114-特推會-04 的決議...
  → 「經委員會討論後，通過以下決議...」
  是否修改？ [N/y]

[業務報告]
資源班業務報告（可多行，空行結束）：
> 本學期資源班重要行事...
>

[提案]
案由類型？
  [1] 交通補助
  [2] 專團申請
  [3] 助理員申請
  [4] 酌減學生數
  [5] 轉安置
  [6] 課程計畫審議
  [7] 其他
> 1

涉及學生：
  學生 1 姓名：廖祐仁
  班級：四甲
  障別程度：中度智障
  補充資訊（接送人等）：祖父接送
  ---
  再加一位？ [Y/n]
  學生 2 姓名：陳品鑫
  班級：三甲
  障別程度：輕度智障
  補充資訊：祖母接送
  ---
  再加一位？ [Y/n] n

相關公文字號（可選）：114年5月1日府教輔特字第1140100215號

🔍 搜尋歷次「交通補助」會議作為參考...
  找到 5 份：114-01, 113-04, 113-01, 112-03, 112-01

🤖 AI 草擬說明段落中...

━━━ 預覽 ━━━
【案由一】為四甲廖○仁、三甲陳○鑫，申請114年下半年度
身心障礙學生交通補助費，提請討論。

【說  明】
四甲廖生領有第一類中度身心障礙證明，平日由祖父接送
上放學。三甲陳生領有第一類輕度身心障礙證明，平日由
祖母接送上放學。兩名學生皆為特殊教育通報網上之學生，
並有本縣鑑定安置文號，擬由特教業務承辦人為二名學生
提出交通補助費之申請。

【決  議】（會後填入）
━━━━━━━━━━

內容 OK？ [Y] 確認 / [E] 編輯 / [R] 重新生成
> Y

還有其他案由嗎？ [Y/n] n

📝 生成中...
  ✅ .docx → ~/Desktop/114-第5次特推會議記錄(交通補助).docx
  ✅ .md  → Obsidian/02-特教業務/特推會/114-特推會-05-交通補助.md
  ✅ MOC 已更新
```

### 預設值

從 `SCHOOL_DEFAULTS` 讀取（與 iep_pipeline.py 共用）：

```python
SCHOOL_DEFAULTS = {
    "school_name": "○○",
    "chair": "林思遠",
    "recorder": "康雲昇",
    "location": "本校三樓共讀站",
    "academic_year": 114,
}
```

委員名單從 `Obsidian-Cyclone/02-特教業務/特推會/` 下最近一次會議的簽到表自動帶入（如有），或從設定檔讀取。

---

## Markdown 輸出格式

與 `convert_spc_meetings.py` 一致，確保新舊記錄格式統一：

```yaml
---
type: 特推會會議記錄
academic_year: 114
meeting_number: 5
date: "114年8月29日"
chair: "林思遠"
recorder: "康雲昇"
location: "本校三樓共讀站"
topics:
  - 交通補助
decisions:
  - "經委員會討論後，通過以下決議..."
tags: [特推會, 會議記錄]
---
```

存放路徑：`Obsidian-Cyclone/02-特教業務/特推會/{year}-特推會-{NN}-{topic}.md`

---

## Dashboard UI 接軌（後續）

CLI 的每個互動步驟直接對應 UI 元件：

| CLI 互動 | UI 元件 | API 欄位 |
|---|---|---|
| 學年度、第幾次 | number input | `academic_year`, `meeting_number` |
| 會議日期/時間 | date/time picker | `date`, `time_start` |
| 案由類型 | dropdown selector | `proposal_type` |
| 涉及學生 | 動態表格（+/- 學生列） | `students[]` |
| 公文字號 | text input | `ref_doc` |
| 業務報告 | textarea | `business_report` |
| AI 草擬預覽 | 即時預覽面板 | response body |
| 確認/編輯/重新生成 | 按鈕組 | action buttons |
| 產出下載 | download button | file response |

API route 設計：

```
POST /api/education/spc-meeting/draft
  body: { proposal_type, students, ref_doc }
  response: { title, description }    ← AI 草擬結果

POST /api/education/spc-meeting/generate
  body: MeetingRecord (完整資料)
  response: { docx_url, md_path }     ← 生成結果
```

---

## 開發順序

1. **spc_meeting_core.py** — 核心邏輯模組
2. **spc_meeting_cli.py** — 互動式 CLI
3. 測試：用歷史案由驗證 AI 草擬品質
4. **Dashboard API + UI**（與教育工作站 IEP 模組一起做）

---

## 檔案清單

| 檔案 | 狀態 | 說明 |
|---|---|---|
| `scripts/education/convert_spc_meetings.py` | 已完成 | 歷史記錄批次轉 .md |
| `scripts/education/spc_meeting_core.py` | 待開發 | 核心邏輯模組 |
| `scripts/education/spc_meeting_cli.py` | 待開發 | 互動式 CLI |
| `Obsidian/02-特教業務/特推會/*.md` | 已完成 | 25 份歷史記錄 + MOC 索引 |
| `src/app/api/education/spc-meeting/` | 後續 | Dashboard API |
| `src/components/.../spc-meeting-panel.tsx` | 後續 | Dashboard 前端 |
