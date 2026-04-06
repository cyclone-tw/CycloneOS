#!/usr/bin/env python3
"""
html_template.py — Style-C (報紙排版風) HTML template generator
for SPC meeting agenda pages.

Usage:
    from html_template import generate_agenda_html
    html = generate_agenda_html(record, names_to_mask=["林思遠", "康雲昇"])
"""

import html as _html_mod

from spc_meeting_core import (
    MeetingRecord,
    SCHOOL_DEFAULTS,
    mask_pii,
    _chinese_num,
)


# ── PII masking helper ──

def _make_masker(names_to_mask):
    """Return a callable m(text) that masks PII when names are provided."""
    if names_to_mask:
        def m(text: str) -> str:
            if not text:
                return text
            return mask_pii(str(text), names_to_mask)
    else:
        def m(text: str) -> str:
            return str(text) if text else text
    return m


# ── Text helpers ──

def _escape(text: str) -> str:
    """HTML-escape a string."""
    return _html_mod.escape(str(text)) if text else ""


def _nl2br(text: str) -> str:
    """HTML-escape then convert newlines to <br> tags."""
    if not text:
        return ""
    return _html_mod.escape(str(text)).replace("\n", "<br>")


# ── Committee rendering ──

def _render_committee(committee: list, m) -> str:
    """Render committee members as '職稱 姓名' joined by ' ｜ '."""
    parts = []
    for member in committee:
        if isinstance(member, dict):
            title = member.get("title", "").replace("\n", " ")
            name = member.get("name", "")
        elif hasattr(member, "title"):
            title = getattr(member, "title", "").replace("\n", " ")
            name = getattr(member, "name", "")
        else:
            continue
        if title or name:
            parts.append(_escape(m(f"{title} {name}".strip())))
    return " ｜ ".join(parts)


# ── Student rendering ──

def _render_students(students: list, m) -> str:
    """Render students list as an HTML table or inline text."""
    if not students:
        return ""

    # Check if students are dicts (structured) or strings
    if all(isinstance(s, str) for s in students):
        items = "".join(
            f"<li>{_escape(m(s))}</li>" for s in students if s
        )
        return f"<ul class='student-list'>{items}</ul>" if items else ""

    # Structured dicts — render as table
    rows = []
    for s in students:
        if isinstance(s, dict):
            name = _escape(m(s.get("name", "")))
            grade = _escape(s.get("grade", ""))
            disability = _escape(s.get("disability", ""))
            detail = _escape(m(s.get("detail", "")))
            rows.append(
                f"<tr>"
                f"<td>{name}</td>"
                f"<td>{grade}</td>"
                f"<td>{disability}</td>"
                f"<td>{detail}</td>"
                f"</tr>"
            )
        elif isinstance(s, str):
            rows.append(
                f"<tr><td colspan='4'>{_escape(m(s))}</td></tr>"
            )

    if not rows:
        return ""

    return (
        "<table class='student-table'>"
        "<thead><tr>"
        "<th>姓名</th><th>年級</th><th>障礙類別</th><th>備註</th>"
        "</tr></thead>"
        "<tbody>" + "".join(rows) + "</tbody>"
        "</table>"
    )


# ── CSS ──

_CSS = """
* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

body {
    font-family: 'Noto Sans TC', 'Microsoft JhengHei', sans-serif;
    font-size: 15px;
    line-height: 1.75;
    color: #111;
    background: #fff;
    padding: 32px 16px 48px;
}

.page {
    max-width: 800px;
    margin: 0 auto;
}

/* ── Header ── */
.meeting-header {
    border-bottom: 2px solid #333;
    padding-bottom: 16px;
    margin-bottom: 24px;
}

.meeting-header .school-line {
    font-size: 13px;
    color: #555;
    margin-bottom: 4px;
    letter-spacing: 0.05em;
}

.meeting-header .title {
    font-size: 22px;
    font-weight: 900;
    letter-spacing: 0.08em;
    line-height: 1.3;
    margin-bottom: 8px;
}

.meeting-header .meta {
    font-size: 13px;
    color: #444;
    display: flex;
    flex-wrap: wrap;
    gap: 4px 20px;
}

.meeting-header .meta span::before {
    content: "▸ ";
    color: #999;
}

/* ── Section headings ── */
.section-heading {
    font-size: 14px;
    font-weight: 700;
    border-left: 3px solid #333;
    padding-left: 8px;
    margin: 28px 0 12px;
    letter-spacing: 0.04em;
}

/* ── Body text ── */
.body-text {
    font-size: 14px;
    color: #333;
    margin-bottom: 12px;
    padding-left: 4px;
}

/* ── Proposal boxes ── */
.proposals-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.proposal-box {
    background: #fafafa;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 16px 18px;
}

.proposal-box .proposal-title {
    font-size: 14px;
    font-weight: 700;
    margin-bottom: 10px;
    border-left: 3px solid #555;
    padding-left: 8px;
}

.proposal-box .proposal-label {
    font-size: 12px;
    font-weight: 700;
    color: #555;
    margin: 10px 0 4px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
}

.proposal-box .proposal-description {
    font-size: 13px;
    color: #333;
    line-height: 1.8;
}

.proposal-box .proposal-decision {
    font-size: 13px;
    color: #333;
    line-height: 1.8;
}

.proposal-box .decision-pending {
    font-style: italic;
    color: #999;
}

.proposal-box .ref-doc {
    font-size: 12px;
    color: #777;
    margin-top: 6px;
}

/* ── Student tables ── */
.student-table {
    border-collapse: collapse;
    width: 100%;
    font-size: 13px;
    margin: 8px 0;
}

.student-table th,
.student-table td {
    border: 1px solid #ccc;
    padding: 5px 9px;
    text-align: left;
}

.student-table th {
    background: #f0f0f0;
    font-weight: 700;
}

.student-list {
    font-size: 13px;
    padding-left: 20px;
    margin: 6px 0;
    color: #333;
}

/* ── Committee line ── */
.committee-line {
    font-size: 13px;
    color: #444;
    line-height: 2;
    padding-left: 4px;
}

/* ── Footer ── */
.page-footer {
    margin-top: 40px;
    padding-top: 12px;
    border-top: 1px solid #ccc;
    font-size: 12px;
    color: #aaa;
    text-align: center;
    letter-spacing: 0.04em;
}

/* ── Responsive ── */
@media (max-width: 600px) {
    body {
        padding: 16px 10px 32px;
    }
    .meeting-header .title {
        font-size: 18px;
    }
    .meeting-header .meta {
        flex-direction: column;
        gap: 2px;
    }
    .student-table {
        display: block;
        overflow-x: auto;
    }
}
""".strip()


# ── Main function ──

def generate_agenda_html(record: MeetingRecord, names_to_mask=None) -> str:
    """
    Generate a self-contained HTML string for a SPC meeting agenda page.

    Args:
        record: MeetingRecord dataclass instance.
        names_to_mask: Optional list of name strings to mask for PII.

    Returns:
        A complete, self-contained HTML document string.
    """
    m = _make_masker(names_to_mask)

    school = SCHOOL_DEFAULTS.get("school_name", "")
    year = record.academic_year
    num = record.meeting_number

    # ── Page title ──
    page_title = _escape(
        f"{school}國小{year}學年度第{num}次特推會會議議程"
    )

    # ── Header ──
    school_line = _escape(
        f"南投縣{school}國民小學 · {year}學年度特殊教育推行委員會"
    )
    meeting_title = _escape(f"第{num}次會議議程")

    # Build meta items
    meta_parts = []
    if record.date:
        date_str = record.date
        if hasattr(record, "weekday") and record.weekday:
            date_str += f"（{record.weekday}）"
        meta_parts.append(f"<span>日期：{_escape(date_str)}</span>")
    if record.time_start:
        time_str = record.time_start
        if record.time_end:
            time_str += f" – {record.time_end}"
        meta_parts.append(f"<span>時間：{_escape(time_str)}</span>")
    if record.location:
        meta_parts.append(f"<span>地點：{_escape(record.location)}</span>")
    if record.chair:
        meta_parts.append(f"<span>主席：{_escape(m(record.chair))}</span>")
    if record.recorder:
        meta_parts.append(f"<span>記錄：{_escape(m(record.recorder))}</span>")

    meta_html = "\n            ".join(meta_parts)

    # ── Business report ──
    business_html = ""
    if record.business_report:
        business_html = f"""
        <h2 class='section-heading'>業務報告</h2>
        <div class='body-text'>{_nl2br(m(record.business_report))}</div>"""

    # ── Previous tracking ──
    tracking_html = ""
    if record.previous_tracking:
        tracking_html = f"""
        <h2 class='section-heading'>前次會議決議追蹤</h2>
        <div class='body-text'>{_nl2br(m(record.previous_tracking))}</div>"""

    # ── Proposals ──
    proposals_html = ""
    if record.proposals:
        boxes = []
        for i, p in enumerate(record.proposals, 1):
            cn = _chinese_num(i)
            title_str = _escape(m(f"案由{cn}：{p.title}"))

            desc_html = ""
            if p.description:
                desc_html = (
                    f"<div class='proposal-label'>說明</div>"
                    f"<div class='proposal-description'>{_nl2br(m(p.description))}</div>"
                )

            # Decision — show pending in italic gray
            decision_text = p.decision if p.decision else ""
            is_pending = not decision_text or decision_text in (
                "（會後填入）", "待會議決定", ""
            )
            if is_pending:
                decision_inner = "<span class='decision-pending'>待會議決定</span>"
            else:
                decision_inner = _nl2br(m(decision_text))

            decision_html = (
                f"<div class='proposal-label'>決議</div>"
                f"<div class='proposal-decision'>{decision_inner}</div>"
            )

            students_html = ""
            if p.students:
                rendered = _render_students(p.students, m)
                if rendered:
                    students_html = (
                        f"<div class='proposal-label'>相關學生</div>"
                        f"{rendered}"
                    )

            ref_html = ""
            if p.ref_doc:
                ref_html = (
                    f"<div class='ref-doc'>參考文件：{_escape(p.ref_doc)}</div>"
                )

            box = (
                f"<div class='proposal-box'>"
                f"<div class='proposal-title'>{title_str}</div>"
                f"{desc_html}"
                f"{students_html}"
                f"{decision_html}"
                f"{ref_html}"
                f"</div>"
            )
            boxes.append(box)

        proposals_html = (
            "\n        <h2 class='section-heading'>提案討論</h2>"
            "\n        <div class='proposals-list'>"
            + "\n        ".join(boxes)
            + "\n        </div>"
        )

    # ── Motions ──
    motions_text = record.motions if record.motions else "無"
    motions_html = (
        f"\n        <h2 class='section-heading'>臨時動議</h2>"
        f"\n        <div class='body-text'>{_nl2br(m(motions_text))}</div>"
    )

    # ── Committee ──
    committee_html = ""
    if record.committee:
        committee_str = _render_committee(record.committee, m)
        if committee_str:
            committee_html = (
                f"\n        <h2 class='section-heading'>出席委員</h2>"
                f"\n        <div class='committee-line'>{committee_str}</div>"
            )

    # ── Assemble ──
    return f"""<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{page_title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;700;900&display=swap" rel="stylesheet">
<style>
{_CSS}
</style>
</head>
<body>
<div class="page">
    <header class="meeting-header">
        <div class="school-line">{school_line}</div>
        <div class="title">{meeting_title}</div>
        <div class="meta">
            {meta_html}
        </div>
    </header>
{business_html}{tracking_html}{proposals_html}{motions_html}{committee_html}
    <footer class="page-footer">
        Generated by CycloneOS Education Workstation
    </footer>
</div>
</body>
</html>"""
