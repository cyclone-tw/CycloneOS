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
    similar = []  # track for reuse in edit/regenerate
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
