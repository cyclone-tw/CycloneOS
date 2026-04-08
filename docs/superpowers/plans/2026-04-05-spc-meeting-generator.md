# 特推會會議記錄產生器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a CLI tool that semi-automatically generates 特推會 meeting records (.docx + .md), with AI-drafted proposal descriptions referencing historical meetings.

**Architecture:** Core logic module (`spc_meeting_core.py`) with pure functions for fetching similar meetings, drafting proposals via LLM, generating .docx, and saving .md. A separate interactive CLI (`spc_meeting_cli.py`) provides the user interface. Shared docx utilities are extracted from `iep_meeting_generator.py` to avoid duplication.

**Tech Stack:** Python 3, python-docx, subprocess (LLM CLI calls), YAML frontmatter in Markdown

**Spec:** `docs/superpowers/specs/2026-04-05-spc-meeting-generator-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `scripts/education/docx_utils.py` | Shared python-docx helpers (extracted from `iep_meeting_generator.py`) |
| `scripts/education/spc_meeting_core.py` | Core logic: fetch history, draft via LLM, generate docx, save md |
| `scripts/education/spc_meeting_cli.py` | Interactive CLI interface |
| `scripts/education/iep_meeting_generator.py` | Modified: import from `docx_utils.py` instead of inline helpers |

---

### Task 1: Extract shared docx utilities

Both `iep_meeting_generator.py` and the new SPC generator need the same python-docx helpers (`setup_page`, `set_run_font`, `add_paragraph`, `set_cell_text`, `set_cell_multiline`, `add_table_borders`, `merge_cells`). Extract them to avoid duplication.

**Files:**
- Create: `scripts/education/docx_utils.py`
- Modify: `scripts/education/iep_meeting_generator.py`

- [ ] **Step 1: Create `docx_utils.py` with shared helpers**

```python
#!/usr/bin/env python3
"""
docx_utils.py — 共用 python-docx 工具函數

供 iep_meeting_generator.py 和 spc_meeting_core.py 共用。
"""

from docx import Document
from docx.shared import Pt, Cm, Emu
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement


# ── 格式常數 ──

CHINESE_FONT = "標楷體"
ENGLISH_FONT = "Times New Roman"
TITLE_SIZE = Pt(14)
BODY_SIZE = Pt(10)
SMALL_SIZE = Pt(10)

PAGE_WIDTH = Emu(7772400)   # A4
PAGE_HEIGHT = Emu(10058400)


def setup_page(section):
    section.page_width = PAGE_WIDTH
    section.page_height = PAGE_HEIGHT
    section.top_margin = Cm(2.0)
    section.bottom_margin = Cm(2.0)
    section.left_margin = Cm(2.5)
    section.right_margin = Cm(2.5)


def set_run_font(run, size=None, bold=None):
    if size is None:
        size = BODY_SIZE
    run.font.size = size
    run.font.bold = bold
    run.font.name = ENGLISH_FONT
    r = run._element
    rPr = r.get_or_add_rPr()
    rFonts = rPr.find(qn("w:rFonts"))
    if rFonts is None:
        rFonts = OxmlElement("w:rFonts")
        rPr.insert(0, rFonts)
    rFonts.set(qn("w:eastAsia"), CHINESE_FONT)


def add_paragraph(doc, text, size=None, bold=None, alignment=None,
                  space_before=None, space_after=None):
    p = doc.add_paragraph()
    if alignment is not None:
        p.alignment = alignment
    fmt = p.paragraph_format
    fmt.space_before = space_before or Pt(0)
    fmt.space_after = space_after or Pt(0)
    fmt.line_spacing = Pt(18) if size and size <= Pt(12) else Pt(22)
    run = p.add_run(text)
    set_run_font(run, size=size, bold=bold)
    return p


def set_cell_text(cell, text, size=None, bold=None,
                  alignment=WD_ALIGN_PARAGRAPH.CENTER, vertical_center=True):
    cell.text = ""
    p = cell.paragraphs[0]
    p.alignment = alignment
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(2)
    run = p.add_run(text)
    set_run_font(run, size=size or BODY_SIZE, bold=bold)
    if vertical_center:
        tc = cell._tc
        tcPr = tc.get_or_add_tcPr()
        vAlign = OxmlElement("w:vAlign")
        vAlign.set(qn("w:val"), "center")
        tcPr.append(vAlign)


def set_cell_multiline(cell, text, size=None):
    """多行文字寫入 cell，保留換行。"""
    cell.text = ""
    for i, line in enumerate(text.split("\n")):
        if i == 0:
            p = cell.paragraphs[0]
        else:
            p = cell.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p.paragraph_format.space_before = Pt(1)
        p.paragraph_format.space_after = Pt(1)
        p.paragraph_format.line_spacing = Pt(16)
        run = p.add_run(line)
        set_run_font(run, size=size or BODY_SIZE)


def add_table_borders(table):
    tbl = table._tbl
    tblPr = tbl.tblPr if tbl.tblPr is not None else OxmlElement("w:tblPr")
    borders = OxmlElement("w:tblBorders")
    for name in ["top", "left", "bottom", "right", "insideH", "insideV"]:
        border = OxmlElement(f"w:{name}")
        border.set(qn("w:val"), "single")
        border.set(qn("w:sz"), "4")
        border.set(qn("w:space"), "0")
        border.set(qn("w:color"), "000000")
        borders.append(border)
    tblPr.append(borders)


def merge_cells(table, row, col_start, col_end):
    cell_start = table.cell(row, col_start)
    cell_end = table.cell(row, col_end)
    cell_start.merge(cell_end)
```

- [ ] **Step 2: Update `iep_meeting_generator.py` to import from `docx_utils`**

Replace the inline helper definitions (lines 12-136 of `iep_meeting_generator.py`) with imports:

```python
# Replace these imports and inline definitions:
#   from docx import Document
#   from docx.shared import Pt, Cm, Emu
#   ... (all the helper functions)
# With:

from docx import Document
from docx.shared import Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT

from docx_utils import (
    setup_page, set_run_font, add_paragraph,
    set_cell_text, set_cell_multiline, add_table_borders, merge_cells,
    CHINESE_FONT, ENGLISH_FONT, TITLE_SIZE, BODY_SIZE, SMALL_SIZE,
)

SIGN_SIZE = Pt(12)
```

Remove the following functions from `iep_meeting_generator.py` (they now live in `docx_utils.py`):
- `setup_page`
- `set_run_font`
- `add_paragraph`
- `set_cell_text`
- `set_cell_multiline`
- `add_table_borders`
- `merge_cells`
- `set_col_width`

Keep `generate_meeting_record()` and `main()` intact.

- [ ] **Step 3: Verify IEP generator still works**

Run:
```bash
cd scripts/education && python3 -c "from iep_meeting_generator import generate_meeting_record; print('OK')"
```
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add scripts/education/docx_utils.py scripts/education/iep_meeting_generator.py
git commit -m "refactor: extract shared docx utilities from iep_meeting_generator"
```

---

### Task 2: Build `spc_meeting_core.py` — history fetching and markdown output

The core module's non-AI functions: reading historical meetings from Obsidian, building markdown output, and updating the MOC index.

**Files:**
- Create: `scripts/education/spc_meeting_core.py`

- [ ] **Step 1: Create `spc_meeting_core.py` with constants, data classes, and history fetching**

```python
#!/usr/bin/env python3
"""
spc_meeting_core.py — 特推會會議記錄產生器核心邏輯

供 CLI 和未來 Dashboard API 共用。
"""

import glob
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass, field

from docx import Document
from docx.shared import Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT

from docx_utils import (
    setup_page, set_run_font, add_paragraph,
    set_cell_text, set_cell_multiline, add_table_borders, merge_cells,
    TITLE_SIZE, BODY_SIZE,
)


# ── 路徑常數 ──

OBSIDIAN_SPC_DIR = os.path.expanduser(
    "~/Library/CloudStorage/GoogleDrive-user@gmail.com"
    "/我的雲端硬碟/Obsidian-Cyclone/02-特教業務/特推會"
)

# ── 學校預設 ──

SCHOOL_DEFAULTS = {
    "school_name": "○○",
    "chair": "○○○",
    "recorder": "○○○",
    "location": "本校三樓共讀站",
    "academic_year": 114,
}

DEFAULT_COMMITTEE = [
    {"title": "主任委員", "role": "校長", "name": "○○○"},
    {"title": "副主任委員\n兼主任秘書", "role": "教導主任", "name": "○○○"},
    {"title": "副主任委員", "role": "總務主任", "name": "○○○"},
    {"title": "委員 兼\n執行秘書", "role": "特教教師", "name": "○○○"},
    {"title": "委員", "role": "教務組長", "name": "○○○"},
    {"title": "委員", "role": "特教教師", "name": "○○○"},
    {"title": "委員", "role": "普通班教師", "name": "○○○"},
    {"title": "委員", "role": "普通班教師", "name": "○○○"},
    {"title": "委員", "role": "家長代表", "name": "○○○"},
]

# ── 案由類型 ──

PROPOSAL_TYPES = [
    "交通補助",
    "專團申請",
    "助理員申請",
    "酌減學生數",
    "轉安置",
    "課程計畫審議",
    "鑑定安置提報",
    "其他",
]


# ── 資料結構 ──

@dataclass
class Proposal:
    type: str
    title: str
    description: str = ""
    decision: str = "（會後填入）"
    students: list = field(default_factory=list)
    ref_doc: str = ""


@dataclass
class MeetingRecord:
    academic_year: int = 114
    meeting_number: int = 1
    date: str = ""
    weekday: str = ""
    time_start: str = "上午08:10"
    time_end: str = ""
    location: str = "本校三樓共讀站"
    chair: str = "○○○"
    recorder: str = "○○○"
    business_report: str = ""
    previous_tracking: str = ""
    proposals: list = field(default_factory=list)
    motions: str = "無"
    committee: list = field(default_factory=list)


# ── 歷史查詢 ──

def fetch_similar_meetings(proposal_type: str, n: int = 3) -> list[dict]:
    """從 Obsidian .md 中找同類案由的歷史會議，回傳最近 n 份。"""
    results = []
    md_files = sorted(
        glob.glob(os.path.join(OBSIDIAN_SPC_DIR, "*.md")),
        reverse=True,
    )

    # 案由類型 → 搜尋關鍵字
    keywords = {
        "交通補助": ["交通補助"],
        "專團申請": ["專團", "專業人員"],
        "助理員申請": ["助理員", "教助"],
        "酌減學生數": ["酌減"],
        "轉安置": ["轉安置"],
        "課程計畫審議": ["課程計畫", "審議"],
        "鑑定安置提報": ["鑑定安置", "提報"],
    }
    search_kws = keywords.get(proposal_type, [proposal_type])

    for md_path in md_files:
        fname = os.path.basename(md_path)
        if fname.startswith("MOC"):
            continue

        with open(md_path, "r", encoding="utf-8") as f:
            content = f.read()

        # 檢查 frontmatter topics 或檔名是否匹配
        matched = any(kw in content[:500] or kw in fname for kw in search_kws)
        if not matched:
            continue

        # 提取說明段落
        desc_blocks = []
        for m in re.finditer(
            r"\*\*說明：\*\*\s*\n\n(.+?)(?=\n\*\*決議|\n###|\Z)",
            content, re.DOTALL,
        ):
            desc_blocks.append(m.group(1).strip())

        if desc_blocks:
            # 從 frontmatter 提取學年度和次數
            year_m = re.search(r"academic_year:\s*(\d+)", content)
            num_m = re.search(r"meeting_number:\s*(\d+)", content)
            results.append({
                "filename": fname,
                "academic_year": int(year_m.group(1)) if year_m else 0,
                "meeting_number": int(num_m.group(1)) if num_m else 0,
                "descriptions": desc_blocks,
            })

        if len(results) >= n:
            break

    return results


def fetch_previous_decisions(academic_year: int, meeting_number: int) -> str:
    """讀取前一次會議的決議，用於「前次會議決議追蹤」。"""
    if meeting_number <= 1:
        return ""

    prev_num = meeting_number - 1
    pattern = os.path.join(
        OBSIDIAN_SPC_DIR,
        f"{academic_year}-特推會-{prev_num:02d}-*.md",
    )
    files = glob.glob(pattern)
    if not files:
        return ""

    with open(files[0], "r", encoding="utf-8") as f:
        content = f.read()

    decisions = []
    for m in re.finditer(r"\*\*決議：\*\*\s*\n\n(.+?)(?=\n###|\n##|\Z)", content, re.DOTALL):
        decisions.append(m.group(1).strip())

    if not decisions:
        return ""

    fname = os.path.basename(files[0])
    topic_m = re.search(r"\d+-特推會-\d+-(.+)\.md", fname)
    topic = topic_m.group(1) if topic_m else ""
    header = f"前次會議（第{prev_num}次，{topic}）決議事項："
    body = "\n".join(f"{i+1}. {d}" for i, d in enumerate(decisions))
    return f"{header}\n{body}"


# ── Markdown 輸出 ──

def build_markdown(record: MeetingRecord) -> str:
    """將 MeetingRecord 轉為結構化 Markdown。"""
    topics = list({p.type for p in record.proposals})
    decisions = []
    for p in record.proposals:
        if p.decision and p.decision != "（會後填入）":
            decisions.append(p.decision.split("\n")[0][:80])

    md = "---\n"
    md += "type: 特推會會議記錄\n"
    md += f"academic_year: {record.academic_year}\n"
    md += f"meeting_number: {record.meeting_number}\n"
    md += f"date: \"{record.date}\"\n"
    md += f"chair: \"{record.chair}\"\n"
    md += f"recorder: \"{record.recorder}\"\n"
    md += f"location: \"{record.location}\"\n"
    md += "topics:\n"
    for t in topics:
        md += f"  - {t}\n"
    md += "decisions:\n"
    for d in decisions:
        md += f"  - \"{d}\"\n"
    if not decisions:
        md += "  - \"（會後填入）\"\n"
    md += "tags: [特推會, 會議記錄]\n"
    md += "---\n\n"

    md += f"# {record.academic_year}學年度 第{record.meeting_number}次特推會會議記錄\n\n"
    topics_str = "、".join(topics)
    md += f"- **日期**：{record.date}\n"
    md += f"- **地點**：{record.location}\n"
    md += f"- **主席**：{record.chair}\n"
    md += f"- **記錄**：{record.recorder}\n"
    md += f"- **主題**：{topics_str}\n\n"
    md += "---\n\n"

    if record.business_report:
        md += f"## 業務報告\n\n{record.business_report}\n\n"

    if record.previous_tracking:
        md += f"## 前次會議決議追蹤\n\n{record.previous_tracking}\n\n"

    if record.proposals:
        md += "## 提案討論\n\n"
        for i, p in enumerate(record.proposals, 1):
            md += f"### 案由{i}：{p.title}\n\n"
            if p.description:
                md += f"**說明：**\n\n{p.description}\n\n"
            md += f"**決議：**\n\n{p.decision}\n\n"

    md += f"## 臨時動議\n\n{record.motions}\n\n"
    if record.time_end:
        md += f"## 散會\n\n{record.time_end}\n\n"

    return md


def save_markdown(record: MeetingRecord) -> str:
    """存 .md 到 Obsidian 並更新 MOC。回傳檔案路徑。"""
    os.makedirs(OBSIDIAN_SPC_DIR, exist_ok=True)

    topics_short = "+".join(t for t in {p.type for p in record.proposals})[:20]
    filename = f"{record.academic_year}-特推會-{record.meeting_number:02d}-{topics_short}.md"
    filepath = os.path.join(OBSIDIAN_SPC_DIR, filename)

    md_content = build_markdown(record)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(md_content)

    update_moc()
    return filepath


def update_moc():
    """重新生成 MOC-特推會.md 索引。"""
    md_files = sorted(glob.glob(os.path.join(OBSIDIAN_SPC_DIR, "*.md")))
    records = []

    for md_path in md_files:
        fname = os.path.basename(md_path)
        if fname.startswith("MOC"):
            continue

        with open(md_path, "r", encoding="utf-8") as f:
            content = f.read()

        year_m = re.search(r"academic_year:\s*(\d+)", content)
        num_m = re.search(r"meeting_number:\s*(\d+)", content)
        date_m = re.search(r'date:\s*"([^"]+)"', content)

        # 提取 topics
        topics = []
        in_topics = False
        for line in content.split("\n"):
            if line.strip().startswith("topics:"):
                in_topics = True
                continue
            if in_topics:
                if line.strip().startswith("- "):
                    topics.append(line.strip()[2:])
                else:
                    break

        # 提取 decisions
        decisions = []
        in_dec = False
        for line in content.split("\n"):
            if line.strip().startswith("decisions:"):
                in_dec = True
                continue
            if in_dec:
                if line.strip().startswith("- "):
                    dec = line.strip()[2:].strip('"')
                    decisions.append(dec[:60])
                else:
                    break

        records.append({
            "filename": fname,
            "academic_year": int(year_m.group(1)) if year_m else 0,
            "meeting_number": int(num_m.group(1)) if num_m else 0,
            "date": date_m.group(1) if date_m else "",
            "topics": "、".join(topics),
            "decisions": "; ".join(decisions)[:60],
        })

    # 生成 MOC
    moc = "---\ntype: MOC\ntags: [特推會, MOC]\n---\n\n"
    moc += "# 特推會會議記錄索引\n\n"
    moc += "> ○○國小特殊教育推行委員會歷次會議記錄\n\n"

    current_year = None
    for rec in sorted(records, key=lambda r: (r["academic_year"], r["meeting_number"])):
        if rec["academic_year"] != current_year:
            current_year = rec["academic_year"]
            moc += f"\n## {current_year} 學年度\n\n"
            moc += "| 次 | 日期 | 主題 | 決議摘要 |\n"
            moc += "|---|---|---|---|\n"

        link = rec["filename"].replace(".md", "")
        moc += f"| [[{link}\\|第{rec['meeting_number']}次]] "
        moc += f"| {rec['date']} "
        moc += f"| {rec['topics']} "
        moc += f"| {rec['decisions']} |\n"

    moc += "\n---\n\n*由 CycloneOS 自動生成*\n"

    moc_path = os.path.join(OBSIDIAN_SPC_DIR, "MOC-特推會.md")
    with open(moc_path, "w", encoding="utf-8") as f:
        f.write(moc)
```

- [ ] **Step 2: Verify imports and history fetching work**

Run:
```bash
cd scripts/education && python3 -c "
from spc_meeting_core import fetch_similar_meetings, fetch_previous_decisions
results = fetch_similar_meetings('交通補助', n=3)
print(f'Found {len(results)} similar meetings')
for r in results:
    print(f'  {r[\"filename\"]}')
prev = fetch_previous_decisions(114, 4)
print(f'Previous decisions: {prev[:100]}...' if prev else 'No previous')
"
```
Expected: finds 3+ 交通補助 meetings, and retrieves previous decisions.

- [ ] **Step 3: Commit**

```bash
git add scripts/education/spc_meeting_core.py
git commit -m "feat: add spc_meeting_core with history fetching and markdown output"
```

---

### Task 3: Add LLM drafting and docx generation to `spc_meeting_core.py`

Add the AI drafting function and the .docx generator to complete the core module.

**Files:**
- Modify: `scripts/education/spc_meeting_core.py`

- [ ] **Step 1: Add `call_llm()` and `draft_proposal()` to `spc_meeting_core.py`**

Append after the `update_moc()` function:

```python
# ── LLM 呼叫 ──

def call_llm(prompt: str) -> str:
    """呼叫 LLM CLI，自動 fallback。"""
    env = os.environ.copy()
    env.pop("ANTHROPIC_API_KEY", None)

    providers = [
        ["claude", "-p"],
        ["codex", "--quiet", "--full-auto"],
    ]

    for cmd in providers:
        try:
            result = subprocess.run(
                cmd, input=prompt,
                capture_output=True, text=True, timeout=300, env=env,
            )
            if result.returncode == 0 and result.stdout.strip():
                return result.stdout.strip()
        except (FileNotFoundError, subprocess.TimeoutExpired):
            continue

    raise RuntimeError("所有 LLM provider 皆失敗")


def draft_proposal(proposal: Proposal, similar: list[dict]) -> str:
    """呼叫 LLM 草擬案由的「說明」段落。"""
    # 組裝歷史參考
    ref_text = ""
    for rec in similar:
        ref_text += f"\n### {rec['filename']}\n"
        for desc in rec["descriptions"]:
            ref_text += desc + "\n"

    students_text = ""
    for s in proposal.students:
        name = s.get("name", "")
        grade = s.get("grade", "")
        disability = s.get("disability", "")
        detail = s.get("detail", "")
        students_text += f"- {grade}{name}，{disability}，{detail}\n"

    prompt = f"""你是國小特教業務承辦人，正在撰寫特推會會議記錄的「說明」段落。

## 案由類型
{proposal.type}

## 本次涉及學生
{students_text if students_text else "（無特定學生）"}

## 相關公文
{proposal.ref_doc if proposal.ref_doc else "（無）"}

## 案由標題
{proposal.title}

## 歷次同類會議的說明段落（供參考格式和用語）
{ref_text if ref_text else "（無歷史參考）"}

## 任務
根據以上資訊，草擬本次案由的「說明」段落。

## 撰寫原則
1. 使用正式公文用語，但不要過度冗長
2. 參考歷次會議的格式和結構
3. 學生姓名中間字用○代替（三字姓名第二字、四字姓名第二三字）
4. 引用公文字號時完整引述
5. 繁體中文
6. 只輸出說明段落的純文字，不要 JSON 包裝，不要加「【說明】」標題
7. 段落用（一）（二）等編號"""

    return call_llm(prompt)


# ── Docx 生成 ──

def mask_name(name: str) -> str:
    """中間字用○代替。"""
    chars = list(name)
    if len(chars) == 3:
        chars[1] = "○"
    elif len(chars) == 4:
        chars[1] = "○"
        chars[2] = "○"
    return "".join(chars)


def generate_docx(record: MeetingRecord, output_path: str) -> str:
    """從零生成特推會會議記錄 .docx。"""
    doc = Document()
    setup_page(doc.sections[0])

    school = SCHOOL_DEFAULTS["school_name"]

    # ── 標題 ──
    add_paragraph(
        doc,
        f"南投縣{school}國民小學{record.academic_year}學年度特殊教育推行委員會",
        size=TITLE_SIZE, bold=True, alignment=WD_ALIGN_PARAGRAPH.CENTER,
        space_after=Pt(0),
    )
    add_paragraph(
        doc,
        f"第{record.meeting_number}次會議紀錄",
        size=TITLE_SIZE, bold=True, alignment=WD_ALIGN_PARAGRAPH.CENTER,
        space_after=Pt(8),
    )

    # ── 基本資訊 ──
    weekday = f"（星期{record.weekday}）" if record.weekday else ""
    add_paragraph(doc, f"壹、會議時間：{record.date}{weekday}{record.time_start}",
                  size=BODY_SIZE)
    add_paragraph(doc, f"貳、會議地點：{record.location}", size=BODY_SIZE)
    add_paragraph(
        doc,
        f"參、主席：{record.chair}                 記錄：{record.recorder}",
        size=BODY_SIZE,
    )
    p = add_paragraph(doc, "肆、出席人員：如會議簽到簿", size=BODY_SIZE)
    # 加「伍、會議議程」在同一段
    add_paragraph(doc, "伍、會議議程", size=BODY_SIZE, space_before=Pt(4))

    # ── 主席致詞 ──
    add_paragraph(doc, "一、主席致詞：（略）", size=BODY_SIZE)

    # ── 業務報告 ──
    if record.business_report:
        add_paragraph(doc, "二、資源班業務報告：", size=BODY_SIZE)
        for line in record.business_report.split("\n"):
            if line.strip():
                add_paragraph(doc, line.strip(), size=BODY_SIZE)

    # ── 前次追蹤 ──
    if record.previous_tracking:
        add_paragraph(doc, "三、前次會議決議事項追蹤報告：", size=BODY_SIZE)
        for line in record.previous_tracking.split("\n"):
            if line.strip():
                add_paragraph(doc, line.strip(), size=BODY_SIZE)

    # ── 提案討論 ──
    section_num = "三" if not record.previous_tracking else "四"
    add_paragraph(doc, f"{section_num}、提案討論：", size=BODY_SIZE, space_before=Pt(4))

    cn_nums = ["一", "二", "三", "四", "五", "六", "七", "八"]
    for i, prop in enumerate(record.proposals):
        add_paragraph(doc, f"【案由{cn_nums[i]}】", size=BODY_SIZE, bold=True,
                      space_before=Pt(4))
        add_paragraph(doc, prop.title, size=BODY_SIZE)
        add_paragraph(doc, "【說  明】", size=BODY_SIZE, bold=True, space_before=Pt(2))
        for line in prop.description.split("\n"):
            if line.strip():
                add_paragraph(doc, line.strip(), size=BODY_SIZE)
        add_paragraph(doc, "【決  議】", size=BODY_SIZE, bold=True, space_before=Pt(2))
        add_paragraph(doc, prop.decision, size=BODY_SIZE)

    # ── 臨時動議 ──
    add_paragraph(doc, "", size=BODY_SIZE)
    add_paragraph(doc, f"陸、臨時動議：{record.motions}", size=BODY_SIZE)

    # ── 散會 ──
    add_paragraph(doc, "", size=BODY_SIZE)
    time_end = record.time_end or "上午   時   分"
    add_paragraph(doc, f"柒、散    會： {time_end}。", size=BODY_SIZE)

    # ── 核章欄 ──
    add_paragraph(doc, "", size=BODY_SIZE, space_after=Pt(12))
    add_paragraph(
        doc,
        "特教業務承辦人：   \t\t\t 單位主管：               校長：",
        size=BODY_SIZE,
    )

    # ── 分頁：簽到表 ──
    doc.add_page_break()

    add_paragraph(
        doc,
        f"南投縣{school}國民小學{record.academic_year}學年度特殊教育推行委員會",
        size=TITLE_SIZE, bold=True, alignment=WD_ALIGN_PARAGRAPH.CENTER,
        space_after=Pt(0),
    )
    add_paragraph(
        doc,
        f"第 {record.meeting_number} 次會議記錄簽到表",
        size=TITLE_SIZE, bold=True, alignment=WD_ALIGN_PARAGRAPH.CENTER,
        space_after=Pt(8),
    )

    committee = record.committee or DEFAULT_COMMITTEE
    rows = len(committee) + 1  # header + members
    sign_table = doc.add_table(rows=rows, cols=4)
    sign_table.alignment = WD_TABLE_ALIGNMENT.CENTER

    # Header
    for ci, header in enumerate(["職稱", "校內職稱", "姓名", "簽到"]):
        set_cell_text(sign_table.cell(0, ci), header, size=BODY_SIZE, bold=True)

    # Members
    for ri, member in enumerate(committee, 1):
        set_cell_text(sign_table.cell(ri, 0), member["title"], size=BODY_SIZE)
        set_cell_text(sign_table.cell(ri, 1), member["role"], size=BODY_SIZE)
        # 姓名字間加空格
        spaced = " ".join(member["name"])
        set_cell_text(sign_table.cell(ri, 2), spaced, size=BODY_SIZE)
        set_cell_text(sign_table.cell(ri, 3), "", size=BODY_SIZE)

    add_table_borders(sign_table)

    doc.save(output_path)
    return output_path
```

- [ ] **Step 2: Verify docx generation works**

Run:
```bash
cd scripts/education && python3 -c "
from spc_meeting_core import MeetingRecord, Proposal, generate_docx
import os

record = MeetingRecord(
    academic_year=114,
    meeting_number=99,
    date='115年4月5日',
    weekday='六',
    time_start='上午08:10',
    chair='○○○',
    recorder='○○○',
    business_report='測試業務報告。',
    proposals=[
        Proposal(
            type='交通補助',
            title='為四甲王○明申請交通補助費，提請討論。',
            description='四甲王生領有第一類中度身心障礙證明，平日由祖父接送上放學。',
            decision='經委員會討論後，通過以下決議。',
        )
    ],
)

out = os.path.expanduser('~/Desktop/test-spc-meeting.docx')
generate_docx(record, out)
print(f'Generated: {out}')
"
```
Expected: `Generated: ~/Desktop/test-spc-meeting.docx` — open the file to visually verify format.

- [ ] **Step 3: Delete the test file, then commit**

```bash
rm ~/Desktop/test-spc-meeting.docx
git add scripts/education/spc_meeting_core.py
git commit -m "feat: add LLM drafting and docx generation to spc_meeting_core"
```

---

### Task 4: Build `spc_meeting_cli.py` — interactive CLI

The user-facing interactive CLI that guides through meeting record creation.

**Files:**
- Create: `scripts/education/spc_meeting_cli.py`

- [ ] **Step 1: Create `spc_meeting_cli.py`**

```python
#!/usr/bin/env python3
"""
spc_meeting_cli.py — 特推會會議記錄互動式 CLI

引導使用者輸入會議資訊，AI 草擬說明段落，產出 .docx + .md。

Usage:
    python3 spc_meeting_cli.py
    python3 spc_meeting_cli.py --skip-ai          # 跳過 AI 草擬
    python3 spc_meeting_cli.py --output-dir ~/Desktop
"""

import argparse
import os
import sys

from spc_meeting_core import (
    SCHOOL_DEFAULTS, PROPOSAL_TYPES, DEFAULT_COMMITTEE,
    MeetingRecord, Proposal,
    fetch_similar_meetings, fetch_previous_decisions,
    draft_proposal, generate_docx, save_markdown, mask_name,
)


def input_default(prompt: str, default: str = "") -> str:
    """帶預設值的 input。"""
    if default:
        result = input(f"{prompt} ({default})：").strip()
        return result if result else default
    return input(f"{prompt}：").strip()


def input_multiline(prompt: str) -> str:
    """多行輸入，空行結束。"""
    print(f"{prompt}（可多行，空行結束）：")
    lines = []
    while True:
        line = input("> ")
        if not line:
            break
        lines.append(line)
    return "\n".join(lines)


def choose_one(prompt: str, options: list[str]) -> tuple[int, str]:
    """單選選單。"""
    print(f"\n{prompt}")
    for i, opt in enumerate(options, 1):
        print(f"  [{i}] {opt}")
    while True:
        choice = input("> ").strip()
        if choice.isdigit() and 1 <= int(choice) <= len(options):
            idx = int(choice) - 1
            return idx, options[idx]
        print(f"  請輸入 1-{len(options)}")


def input_students() -> list[dict]:
    """輸入涉及學生清單。"""
    students = []
    while True:
        print(f"\n  學生 {len(students) + 1}：")
        name = input("    姓名：").strip()
        if not name:
            break
        grade = input("    班級（如四甲）：").strip()
        disability = input("    障別程度（如中度智障）：").strip()
        detail = input("    補充資訊（接送人等，可空）：").strip()
        students.append({
            "name": name,
            "grade": grade,
            "disability": disability,
            "detail": detail,
        })
        more = input("  再加一位？ [Y/n] ").strip().lower()
        if more == "n":
            break
    return students


def preview_proposal(idx: int, proposal: Proposal):
    """預覽一個案由。"""
    cn_nums = ["一", "二", "三", "四", "五", "六", "七", "八"]
    print(f"\n{'━'*50}")
    print(f"【案由{cn_nums[idx]}】")
    print(proposal.title)
    print(f"【說  明】")
    print(proposal.description)
    print(f"【決  議】{proposal.decision}")
    print(f"{'━'*50}")


def main():
    parser = argparse.ArgumentParser(description="特推會會議記錄互動式產生器")
    parser.add_argument("--skip-ai", action="store_true", help="跳過 AI 草擬")
    parser.add_argument("--output-dir", default=os.path.expanduser("~/Desktop"))
    args = parser.parse_args()

    print(f"\n{'='*50}")
    print("📋 特推會會議記錄產生器")
    print(f"{'='*50}\n")

    # ── 基本資訊 ──
    print("[基本資訊]")
    year = int(input_default("學年度", str(SCHOOL_DEFAULTS["academic_year"])))
    meeting_num = int(input("第幾次會議："))
    date = input_default("會議日期", "")
    weekday_map = {"一": "一", "二": "二", "三": "三", "四": "四", "五": "五", "六": "六", "日": "日"}
    weekday = input_default("星期", "五")
    time_start = input_default("開始時間", "上午08:10")
    location = input_default("地點", SCHOOL_DEFAULTS["location"])
    chair = input_default("主席", SCHOOL_DEFAULTS["chair"])
    recorder = input_default("記錄", SCHOOL_DEFAULTS["recorder"])

    record = MeetingRecord(
        academic_year=year,
        meeting_number=meeting_num,
        date=date,
        weekday=weekday,
        time_start=time_start,
        location=location,
        chair=chair,
        recorder=recorder,
        committee=DEFAULT_COMMITTEE,
    )

    # ── 前次決議追蹤 ──
    print("\n[前次會議決議追蹤]")
    prev = fetch_previous_decisions(year, meeting_num)
    if prev:
        print(f"  自動讀取：\n  {prev[:200]}")
        edit = input("  是否修改？ [N/y] ").strip().lower()
        if edit == "y":
            prev = input_multiline("  前次決議追蹤")
    else:
        print("  （找不到前次會議記錄）")
        prev_input = input("  手動輸入？ [N/y] ").strip().lower()
        if prev_input == "y":
            prev = input_multiline("  前次決議追蹤")
    record.previous_tracking = prev

    # ── 業務報告 ──
    print("\n[業務報告]")
    record.business_report = input_multiline("資源班業務報告")

    # ── 提案 ──
    proposals = []
    while True:
        print(f"\n[提案 {len(proposals) + 1}]")
        _, ptype = choose_one("案由類型？", PROPOSAL_TYPES)

        if ptype == "其他":
            ptype = input("  自訂類型名稱：").strip()

        students = input_students()

        ref_doc = input("\n  相關公文字號（可空）：").strip()

        title = input("\n  案由標題（可空，AI 會自動產）：").strip()
        if not title:
            if students:
                student_names = "、".join(
                    f"{s['grade']}{mask_name(s['name'])}" for s in students
                )
                title = f"為{student_names}，辦理{ptype}申請案，提請討論。"
            else:
                title = f"辦理{ptype}，提請討論。"

        proposal = Proposal(
            type=ptype,
            title=title,
            students=students,
            ref_doc=ref_doc,
        )

        # AI 草擬或手動輸入
        if args.skip_ai:
            print("\n  [skip-ai 模式] 請手動輸入說明段落：")
            proposal.description = input_multiline("  說明")
        else:
            print(f"\n🔍 搜尋歷次「{ptype}」會議作為參考...")
            similar = fetch_similar_meetings(ptype, n=3)
            if similar:
                print(f"  找到 {len(similar)} 份：", ", ".join(r["filename"] for r in similar))
            else:
                print("  （無歷史參考）")

            print("\n🤖 AI 草擬說明段落中...\n")
            try:
                draft = draft_proposal(proposal, similar)
                proposal.description = draft
            except RuntimeError as e:
                print(f"  ⚠️ {e}")
                print("  請手動輸入說明段落：")
                proposal.description = input_multiline("  說明")

        # 預覽
        preview_proposal(len(proposals), proposal)

        while True:
            action = input("\n內容 OK？ [Y] 確認 / [E] 編輯 / [R] 重新生成：").strip().upper()
            if action in ("Y", ""):
                break
            elif action == "E":
                print("  輸入新的說明段落（空行結束）：")
                proposal.description = input_multiline("  說明")
                preview_proposal(len(proposals), proposal)
            elif action == "R" and not args.skip_ai:
                print("\n🤖 重新生成中...\n")
                try:
                    proposal.description = draft_proposal(proposal, similar)
                except RuntimeError:
                    print("  ⚠️ AI 失敗，請手動編輯")
                preview_proposal(len(proposals), proposal)

        # 決議
        dec = input("\n  決議（空 = 會後填入）：").strip()
        if dec:
            proposal.decision = dec

        proposals.append(proposal)

        more = input("\n還有其他案由嗎？ [Y/n] ").strip().lower()
        if more == "n":
            break

    record.proposals = proposals

    # ── 散會時間 ──
    record.time_end = input_default("\n散會時間", "")

    # ── 生成 ──
    print(f"\n{'='*50}")
    print("📝 生成中...")

    topics_short = "+".join(p.type for p in proposals)[:20]
    docx_filename = f"{year}-第{meeting_num}次特推會議記錄({topics_short}).docx"
    docx_path = os.path.join(args.output_dir, docx_filename)

    generate_docx(record, docx_path)
    print(f"  ✅ .docx → {docx_path}")

    md_path = save_markdown(record)
    print(f"  ✅ .md  → {md_path}")
    print(f"  ✅ MOC 已更新")

    print(f"\n{'='*50}")
    print("✅ 完成！")
    print(f"{'='*50}\n")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Verify CLI loads without errors**

Run:
```bash
cd scripts/education && python3 -c "from spc_meeting_cli import main; print('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add scripts/education/spc_meeting_cli.py
git commit -m "feat: add interactive CLI for 特推會 meeting record generation"
```

---

### Task 5: End-to-end test with `--skip-ai`

Test the full pipeline without AI to verify docx + md generation works correctly.

**Files:** (no new files — testing existing code)

- [ ] **Step 1: Run CLI in skip-ai mode with piped input**

```bash
cd scripts/education && python3 -c "
from spc_meeting_core import MeetingRecord, Proposal, generate_docx, save_markdown

record = MeetingRecord(
    academic_year=114,
    meeting_number=99,
    date='115年4月5日',
    weekday='六',
    time_start='上午08:10',
    time_end='上午08:30',
    business_report='本次會議召開討論事項主要為交通補助費申請。',
    previous_tracking='前次會議（第3次，專團申請+助理員申請）決議事項：\n1. 通過專業人員服務申請\n2. 通過兩位學生助理員申請',
    proposals=[
        Proposal(
            type='交通補助',
            title='為四甲王○明、三甲李○華，申請114年下半年度身心障礙學生交通補助費，提請討論。',
            description='（一）四甲王生領有第一類中度身心障礙證明，平日由祖父接送上放學。三甲李生領有第一類輕度身心障礙證明，平日由祖母接送上放學。\n（二）兩名學生皆為特殊教育通報網上之學生，並有本縣鑑定安置文號，擬由特教業務承辦人為二名學生提出交通補助費之申請。',
            decision='經委員會討論後，通過以下決議。\n二名學生符合本縣身障生交通補助費之申請資格，由特教業務承辦人備妥相關表件資料與完成核章作業報府處理。',
            students=[
                {'name': '王小明', 'grade': '四甲', 'disability': '中度智障', 'detail': '祖父接送'},
                {'name': '李小華', 'grade': '三甲', 'disability': '輕度智障', 'detail': '祖母接送'},
            ],
        ),
    ],
)

import os
docx_out = os.path.expanduser('~/Desktop/test-e2e-spc.docx')
generate_docx(record, docx_out)
print(f'✅ docx: {docx_out}')

md_out = save_markdown(record)
print(f'✅ md: {md_out}')
"
```

Expected: Both files generated successfully.

- [ ] **Step 2: Visually verify the .docx**

Open `~/Desktop/test-e2e-spc.docx` and confirm:
- Title: 南投縣○○國民小學114學年度特殊教育推行委員會 第99次會議紀錄
- Basic info (日期、地點、主席、記錄)
- 業務報告 section present
- 前次會議決議追蹤 section present
- 案由一 with 說明 and 決議
- 簽到表 on second page with committee members
- Font: 標楷體 10pt body, 14pt title

- [ ] **Step 3: Verify the .md in Obsidian folder**

```bash
cat ~/Library/CloudStorage/GoogleDrive-user@gmail.com/我的雲端硬碟/Obsidian-Cyclone/02-特教業務/特推會/114-特推會-99-交通補助.md | head -30
```

Confirm frontmatter has correct fields and content matches.

- [ ] **Step 4: Clean up test files and commit**

```bash
rm ~/Desktop/test-e2e-spc.docx
rm ~/Library/CloudStorage/GoogleDrive-user@gmail.com/我的雲端硬碟/Obsidian-Cyclone/02-特教業務/特推會/114-特推會-99-交通補助.md

# Regenerate MOC to remove the test entry
cd scripts/education && python3 -c "from spc_meeting_core import update_moc; update_moc()"

git add scripts/education/
git commit -m "test: verify spc meeting generator end-to-end"
```

---

## Summary

| Task | What | Files |
|---|---|---|
| 1 | Extract shared docx utilities | `docx_utils.py`, modify `iep_meeting_generator.py` |
| 2 | Core: history fetching + markdown output | `spc_meeting_core.py` (part 1) |
| 3 | Core: LLM drafting + docx generation | `spc_meeting_core.py` (part 2) |
| 4 | Interactive CLI | `spc_meeting_cli.py` |
| 5 | End-to-end verification | (testing only) |
