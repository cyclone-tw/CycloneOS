#!/usr/bin/env python3
"""
iep_meeting_generator.py — 從零生成 IEP 會議記錄 .docx

根據 LLM 分析結果（JSON），生成一份乾淨的 IEP 會議記錄文件。
格式參考南投縣 IEP 會議記錄模板（113/114 學年度格式）。

Usage:
    python3 iep_meeting_generator.py <content.json> --output output.docx
"""

import json
import sys
import os
import argparse

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
SIGN_SIZE = Pt(12)

PAGE_WIDTH = Emu(7772400)   # A4
PAGE_HEIGHT = Emu(10058400)


# ── 工具函數（改良自 sped-doc-generator/doc_engine.py）──

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
    # 行距設為單行
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
    """合併同一行的多個欄位。"""
    cell_start = table.cell(row, col_start)
    cell_end = table.cell(row, col_end)
    cell_start.merge(cell_end)


def set_col_width(table, col_idx, width):
    for row in table.rows:
        row.cells[col_idx].width = width


# ── 會議記錄生成 ──

def generate_meeting_record(data: dict, output_path: str):
    """
    data 格式：
    {
        "school_name": "○○",
        "academic_year": "114",
        "semester": 1,
        "meeting_type": "擬訂" | "檢討",
        "student_name": "廖祐仁",
        "meeting_date": "114年6月26日",
        "location": "2F會議室",
        "chair": "林甘偉",
        "recorder": "康雲昇",
        "discussion": "討論內容...",
        "resolution": "決議內容...",
        "attendees": {
            "admin": ["余姵融"],
            "parents": ["廖金南"],
            "regular_teachers": ["邱彤慧"],
            "special_ed_teachers": ["康雲昇", "徐雪霞"],
            "professionals": [],
            "assistants": ["陳阿姨"]
        }
    }
    """
    doc = Document()
    setup_page(doc.sections[0])

    school = data.get("school_name", "____")
    year = data.get("academic_year", "___")
    semester = data.get("semester", 1)
    mtype = data.get("meeting_type", "擬訂")
    student = data.get("student_name", "________")
    mdate = data.get("meeting_date", "   年   月   日")
    location = data.get("location", "________")
    chair = data.get("chair", "________")
    recorder = data.get("recorder", "________")

    # ── 標題 ──
    add_paragraph(
        doc,
        f"南投縣 {school} 國小 {year} 學年度第 {semester} 學期學生個別化教育計畫{mtype}會議",
        size=TITLE_SIZE, bold=True, alignment=WD_ALIGN_PARAGRAPH.CENTER,
        space_after=Pt(6),
    )

    # ── 基本資訊 ──
    add_paragraph(doc, f"學生姓名：{student}　　　　　　　　　　　　　　　會議日期：{mdate}", size=BODY_SIZE)
    add_paragraph(doc, f"地　　點：{location}", size=BODY_SIZE)
    add_paragraph(doc, f"主　　席：{chair}　　　　　　　　　　　　　　　　記錄者：{recorder}", size=BODY_SIZE,
                  space_after=Pt(6))

    # ── 簽到表 ──
    attendees = data.get("attendees", {})
    cols = ["行政人員", "學生家長\n及學生", "普通班教師", "特教教師", "相關專業人員", "相關助理人員"]
    att_data = [
        attendees.get("admin", []),
        attendees.get("parents", []),
        attendees.get("regular_teachers", []),
        attendees.get("special_ed_teachers", []),
        attendees.get("professionals", []),
        attendees.get("assistants", []),
    ]

    max_rows = 3  # 固定 3 行簽名欄

    sign_table = doc.add_table(rows=2 + max_rows, cols=6)
    sign_table.alignment = WD_TABLE_ALIGNMENT.CENTER

    # 第一行：合併為「與會者簽名」
    merge_cells(sign_table, 0, 0, 5)
    set_cell_text(sign_table.cell(0, 0), "與會者簽名", size=BODY_SIZE, bold=True)

    # 第二行：欄位標題
    for ci, header in enumerate(cols):
        set_cell_text(sign_table.cell(1, ci), header, size=SMALL_SIZE, bold=True)

    # 簽名行：留空（由與會人員現場簽名）
    for ri in range(max_rows):
        for ci in range(6):
            set_cell_text(sign_table.cell(2 + ri, ci), "", size=BODY_SIZE)

    add_table_borders(sign_table)

    # 間距
    add_paragraph(doc, "", space_after=Pt(4))

    # ── 會議紀錄表 ──
    record_table = doc.add_table(rows=5, cols=1)
    record_table.alignment = WD_TABLE_ALIGNMENT.CENTER

    # Row 0: 標題
    set_cell_text(record_table.cell(0, 0), "會議紀錄", size=BODY_SIZE, bold=True)

    # Row 1: 子標題
    set_cell_text(record_table.cell(1, 0), "個案報告及討論事項", size=BODY_SIZE, bold=True)

    # Row 2: 討論內容（主要內容）
    discussion = data.get("discussion", "")
    set_cell_multiline(record_table.cell(2, 0), discussion, size=BODY_SIZE)

    # Row 3: 決議標題
    set_cell_text(record_table.cell(3, 0), "會議決議", size=BODY_SIZE, bold=True)

    # Row 4: 決議內容
    resolution = data.get("resolution", "")
    set_cell_multiline(record_table.cell(4, 0), resolution, size=BODY_SIZE)

    add_table_borders(record_table)

    # ── 簽名欄 ──
    add_paragraph(doc, "", space_after=Pt(8))

    if mtype == "擬訂":
        add_paragraph(doc, "本人已詳細閱讀，並同意這份計畫的執行！", size=BODY_SIZE)
        add_paragraph(doc, f"日期：　　　　　　　　　　　　　　家長簽名：____________________", size=BODY_SIZE,
                      space_after=Pt(12))
    else:
        add_paragraph(doc, f"家長確認簽名：____________________　　　　　日期：", size=BODY_SIZE,
                      space_after=Pt(12))

    add_paragraph(doc, "承辦人：　　　　　　　　主管：　　　　　　　　校長：", size=BODY_SIZE)

    doc.save(output_path)
    return output_path


# ── CLI ──

def main():
    parser = argparse.ArgumentParser(description="從零生成 IEP 會議記錄")
    parser.add_argument("content_json", help="LLM 產出的內容 JSON")
    parser.add_argument("--output", required=True, help="輸出 .docx 路徑")

    args = parser.parse_args()

    with open(args.content_json, "r", encoding="utf-8") as f:
        data = json.load(f)

    output = generate_meeting_record(data, args.output)
    print(f"✅ 已生成：{output}")


if __name__ == "__main__":
    main()
