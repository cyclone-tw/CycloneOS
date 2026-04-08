#!/usr/bin/env python3
"""
iep_batch.py — 依資料夾分類批次處理 IEP 會議錄音

資料夾命名規則：
  期初擬定/   → 單場，產出 1 份期初擬定
  期末檢討/   → 單場，產出 1 份期末檢討
  跨學期/     → 合開，產出 期末檢討 + 下學期期初擬定
  跨學年/     → 合開，產出 期末檢討 + 下學年度期初擬定

每個資料夾內放 .m4a 錄音檔，檔名建議包含學生姓名。

Usage:
    python3 iep_batch.py <資料夾路徑> \
        --academic-year 113 \
        --semester 2 \
        --output-dir ~/Desktop/IEP產出

    # 範例：處理跨學年資料夾
    python3 iep_batch.py ~/IEP錄音/跨學年/ \
        --academic-year 113 \
        --semester 2 \
        --output-dir ~/Desktop/IEP產出

目錄結構範例：
    IEP錄音/
    ├── 期初擬定/
    │   ├── 王小明.m4a
    │   └── 李小華.m4a
    ├── 期末檢討/
    │   └── 王小明.m4a
    ├── 跨學期/
    │   ├── 王小明.m4a
    │   └── 李小華.m4a
    └── 跨學年/
        ├── 王小明.m4a
        └── 李小華.m4a
"""

import argparse
import glob
import json
import os
import re
import subprocess
import sys
import tempfile
import shutil
from datetime import datetime

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)

from iep_pipeline import (
    get_file_date, mask_name, step_transcribe, step_save_transcript,
    step_ai_analyze, SCHOOL_DEFAULTS,
)
from iep_meeting_generator import generate_meeting_record


# ── 資料夾模式判斷 ──

FOLDER_MODES = {
    "期初擬定": "single_initial",
    "期末檢討": "single_review",
    "跨學期": "cross_semester",
    "跨學年": "cross_year",
}


def detect_mode(folder_path: str) -> str:
    """從資料夾名稱判斷處理模式。"""
    folder_name = os.path.basename(folder_path.rstrip("/"))
    for key, mode in FOLDER_MODES.items():
        if key in folder_name:
            return mode
    print(f"❌ 無法判斷資料夾模式：{folder_name}", file=sys.stderr)
    print(f"   資料夾名稱必須包含：{', '.join(FOLDER_MODES.keys())}", file=sys.stderr)
    sys.exit(1)


def extract_student_name(filename: str) -> str:
    """從檔名提取學生姓名。"""
    name = os.path.splitext(filename)[0]
    # 移除常見前綴（日期、會議等）
    name = re.sub(r'^\d{3,4}[\._\-]?\d{1,2}[\._\-]?\d{1,2}[\._\-]?', '', name)
    name = re.sub(r'^IEP會議[（(]?', '', name)
    name = re.sub(r'[）)]$', '', name)
    name = re.sub(r'^新錄音\s*\d*$', '', name)
    name = name.strip('_- ')
    return name if name else None


def compute_next_period(academic_year: int, semester: int, mode: str):
    """計算下一個學期/學年的資訊。"""
    if mode == "cross_semester":
        # 同學年，學期 1→2
        return academic_year, semester + 1 if semester == 1 else 2
    elif mode == "cross_year":
        # 學年 +1，學期回到 1
        return academic_year + 1, 1
    return academic_year, semester


def generate_split_prompt(transcript: str, student_name: str, meeting_date: str,
                          academic_year: int, semester: int, mode: str) -> str:
    """產出合開會議的拆分 prompt，讓 LLM 一次輸出兩份。"""

    next_year, next_sem = compute_next_period(academic_year, semester, mode)

    year_label = "下學年度" if mode == "cross_year" else "下學期"

    return f"""你是一位資深特教教師。以下是一場合開的 IEP 會議錄音逐字稿，同時包含「期末檢討」和「{year_label}期初擬定」的討論。

請將內容拆分為兩份獨立的會議記錄。

## 會議資訊
- 學生姓名：{student_name}
- 會議日期：{meeting_date}
- 當前：{academic_year} 學年度第 {semester} 學期（期末檢討）
- 下一期：{next_year} 學年度第 {next_sem} 學期（期初擬定）

## 逐字稿
{transcript}

## 任務

產出以下 JSON（只輸出 JSON，不要其他文字）：

```json
{{
  "review": {{
    "discussion": "討論內容摘要如下：\\n(一) (本學期)學生能力現況的改變。\\n...",
    "resolution": "1. 決議一\\n2. 決議二\\n..."
  }},
  "initial": {{
    "discussion": "討論內容摘要如下：\\n(一) 學生能力現況與需求評估。\\n...",
    "resolution": "1. 決議一\\n2. 決議二\\n..."
  }}
}}
```

## 拆分原則

**期末檢討**（review）聚焦：
(一) (本學期)學生能力現況的改變
(二) (本學期)各領域的學習結果及行為處理成效
(三) 相關服務執行成效
(四) 其他

**{year_label}期初擬定**（initial）聚焦：
(一) 學生能力現況與需求評估
(二) {year_label}特教課程規劃討論
(三) 預計之教育目標之討論
(四) 討論教學及支持策略
(五) 相關服務與支持策略申請
(六) 其他

## 注意事項
1. 同一個事實可以出現在兩份記錄，但**角度不同**
   - 期末：「本學期學生在造句方面仍有困難」（回顧）
   - 期初：「下學期將加強造句訓練，採用心智圖策略」（規劃）
2. 從逐字稿提取實質內容，不編造
3. 用專業特教用語潤飾
4. 繁體中文
5. {"注意學年度不同，學生可能升年級，課程安排可能調整" if mode == "cross_year" else ""}
6. 決議要具體可執行"""


def process_single(audio_path: str, student_name: str, meeting_type: str,
                   academic_year: int, semester: int, meeting_date: str,
                   output_dir: str, file_date: str, tmp_dir: str,
                   transcript: str = None):
    """處理單場會議。"""
    # Whisper
    if transcript is None:
        txt_path = step_transcribe(audio_path, tmp_dir)
        _, transcript = step_save_transcript(txt_path, student_name, meeting_date, file_date)

    # AI 分析
    ai_result = step_ai_analyze(transcript, meeting_type, student_name, meeting_date)

    # 生成
    mtype_label = "擬訂" if meeting_type == "期初擬定" else "檢討"
    data = {
        "school_name": SCHOOL_DEFAULTS["school_name"],
        "academic_year": str(academic_year),
        "semester": semester,
        "meeting_type": mtype_label,
        "student_name": student_name,
        "meeting_date": meeting_date,
        "location": SCHOOL_DEFAULTS["location"],
        "chair": SCHOOL_DEFAULTS["chair"],
        "recorder": SCHOOL_DEFAULTS["recorder"],
        "discussion": ai_result.get("discussion", ""),
        "resolution": ai_result.get("resolution", ""),
        "attendees": {},
    }

    masked = mask_name(student_name)
    filename = f"{file_date}-{masked}-{academic_year}學年度第{semester}學期IEP{meeting_type}會議記錄.docx"
    output_path = os.path.join(output_dir, filename)
    generate_meeting_record(data, output_path)
    print(f"  📄 {output_path}")
    return output_path


def process_split(audio_path: str, student_name: str,
                  academic_year: int, semester: int, meeting_date: str,
                  output_dir: str, file_date: str, tmp_dir: str, mode: str,
                  transcript: str = None):
    """處理合開會議（拆分為兩份）。"""
    # Whisper
    if transcript is None:
        txt_path = step_transcribe(audio_path, tmp_dir)
        _, transcript = step_save_transcript(txt_path, student_name, meeting_date, file_date)

    # AI 拆分分析
    print("🤖 AI 分析並拆分合開會議 ...")
    prompt = generate_split_prompt(
        transcript, student_name, meeting_date,
        academic_year, semester, mode,
    )

    env = os.environ.copy()
    env.pop("ANTHROPIC_API_KEY", None)

    result = subprocess.run(
        ["claude", "-p"], input=prompt,
        capture_output=True, text=True, timeout=600, env=env,
    )

    if result.returncode != 0:
        result = subprocess.run(
            ["codex", "--quiet", "--full-auto"], input=prompt,
            capture_output=True, text=True, timeout=600, env=env,
        )

    response = result.stdout.strip()
    import re as _re
    match = _re.search(r'\{[\s\S]*\}', response)
    if not match:
        print(f"  ❌ 無法解析 AI 回應", file=sys.stderr)
        sys.exit(1)

    split_result = json.loads(match.group())
    print("  ✅ 拆分完成")

    next_year, next_sem = compute_next_period(academic_year, semester, mode)
    masked = mask_name(student_name)
    outputs = []

    # 生成期末檢討
    review_data = {
        "school_name": SCHOOL_DEFAULTS["school_name"],
        "academic_year": str(academic_year),
        "semester": semester,
        "meeting_type": "檢討",
        "student_name": student_name,
        "meeting_date": meeting_date,
        "location": SCHOOL_DEFAULTS["location"],
        "chair": SCHOOL_DEFAULTS["chair"],
        "recorder": SCHOOL_DEFAULTS["recorder"],
        "discussion": split_result.get("review", {}).get("discussion", ""),
        "resolution": split_result.get("review", {}).get("resolution", ""),
        "attendees": {},
    }
    review_path = os.path.join(
        output_dir,
        f"{file_date}-{masked}-{academic_year}學年度第{semester}學期IEP期末檢討會議記錄.docx"
    )
    generate_meeting_record(review_data, review_path)
    print(f"  📄 {review_path}")
    outputs.append(review_path)

    # 生成期初擬定
    initial_data = {
        "school_name": SCHOOL_DEFAULTS["school_name"],
        "academic_year": str(next_year),
        "semester": next_sem,
        "meeting_type": "擬訂",
        "student_name": student_name,
        "meeting_date": meeting_date,
        "location": SCHOOL_DEFAULTS["location"],
        "chair": SCHOOL_DEFAULTS["chair"],
        "recorder": SCHOOL_DEFAULTS["recorder"],
        "discussion": split_result.get("initial", {}).get("discussion", ""),
        "resolution": split_result.get("initial", {}).get("resolution", ""),
        "attendees": {},
    }
    initial_path = os.path.join(
        output_dir,
        f"{file_date}-{masked}-{next_year}學年度第{next_sem}學期IEP期初擬定會議記錄.docx"
    )
    generate_meeting_record(initial_data, initial_path)
    print(f"  📄 {initial_path}")
    outputs.append(initial_path)

    return outputs


# ── Main ──

def main():
    parser = argparse.ArgumentParser(description="IEP 會議記錄批次處理")
    parser.add_argument("folder", help="錄音檔資料夾（名稱決定處理模式）")
    parser.add_argument("--academic-year", type=int, required=True, help="學年度（如 113）")
    parser.add_argument("--semester", type=int, required=True, help="學期（1 或 2）")
    parser.add_argument("--meeting-date", default=None, help="會議日期（預設從檔案日期推算）")
    parser.add_argument("--output-dir", default=os.path.expanduser("~/Desktop/IEP產出"))

    args = parser.parse_args()
    mode = detect_mode(args.folder)

    # 找所有錄音檔
    audio_files = sorted(
        glob.glob(os.path.join(args.folder, "*.m4a")) +
        glob.glob(os.path.join(args.folder, "*.mp3")) +
        glob.glob(os.path.join(args.folder, "*.wav"))
    )

    if not audio_files:
        print(f"❌ 資料夾中沒有錄音檔：{args.folder}", file=sys.stderr)
        sys.exit(1)

    os.makedirs(args.output_dir, exist_ok=True)
    tmp_dir = tempfile.mkdtemp(prefix="iep_batch_")

    mode_labels = {
        "single_initial": "期初擬定（單場）",
        "single_review": "期末檢討（單場）",
        "cross_semester": "跨學期合開（期末+下學期期初）",
        "cross_year": "跨學年合開（期末+下學年期初）",
    }

    print(f"\n{'='*60}")
    print(f"🏫 IEP 會議記錄批次處理")
    print(f"   模式：{mode_labels[mode]}")
    print(f"   學年度：{args.academic_year} 第 {args.semester} 學期")
    print(f"   錄音檔：{len(audio_files)} 個")
    print(f"   輸出：{args.output_dir}")
    print(f"{'='*60}\n")

    all_outputs = []

    for i, audio_path in enumerate(audio_files, 1):
        filename = os.path.basename(audio_path)
        student_name = extract_student_name(filename)
        file_date = get_file_date(audio_path)
        meeting_date = args.meeting_date or file_date.replace("-", "年", 1).replace("-", "月") + "日"

        if not student_name:
            print(f"\n⚠️  [{i}/{len(audio_files)}] 無法從檔名提取學生姓名：{filename}")
            student_name = input("  請輸入學生姓名：").strip()
            if not student_name:
                print("  跳過此檔案")
                continue

        print(f"\n── [{i}/{len(audio_files)}] {mask_name(student_name)} ──")

        if mode == "single_initial":
            out = process_single(
                audio_path, student_name, "期初擬定",
                args.academic_year, args.semester, meeting_date,
                args.output_dir, file_date, tmp_dir,
            )
            all_outputs.append(out)

        elif mode == "single_review":
            out = process_single(
                audio_path, student_name, "期末檢討",
                args.academic_year, args.semester, meeting_date,
                args.output_dir, file_date, tmp_dir,
            )
            all_outputs.append(out)

        elif mode in ("cross_semester", "cross_year"):
            outs = process_split(
                audio_path, student_name,
                args.academic_year, args.semester, meeting_date,
                args.output_dir, file_date, tmp_dir, mode,
            )
            all_outputs.extend(outs)

    # 總結
    print(f"\n{'='*60}")
    print(f"✅ 全部完成！共產出 {len(all_outputs)} 份文件：")
    for out in all_outputs:
        print(f"   📄 {os.path.basename(out)}")
    print(f"\n   輸出目錄：{args.output_dir}")
    print(f"{'='*60}\n")

    shutil.rmtree(tmp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
