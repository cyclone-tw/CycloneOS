#!/usr/bin/env python3
"""
iep_pipeline.py — IEP 會議記錄一鍵 pipeline

錄音檔 → whisper 逐字稿 → 存 Obsidian → LLM 分析 → 從零生成 .docx

Usage:
    python3 iep_pipeline.py <audio.m4a> \
        --student-name "學生姓名" \
        --meeting-date "114年6月26日" \
        --meeting-type "期末檢討" \
        --output-dir ~/Desktop

    # 跳過 whisper（已有逐字稿）：
    python3 iep_pipeline.py dummy.m4a \
        --skip-whisper --transcript /path/to/transcript.txt \
        --student-name "學生姓名" \
        --meeting-date "114年6月26日" \
        --meeting-type "期末檢討"
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile
import shutil
from datetime import datetime


# ── Paths ──

OBSIDIAN_VAULT = os.path.expanduser(
    "~/Library/CloudStorage/GoogleDrive-user@gmail.com"
    "/我的雲端硬碟/Obsidian-Cyclone"
)
TRANSCRIPT_DIR = os.path.join(OBSIDIAN_VAULT, "CycloneOS/outputs/transcripts")
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# ── 預設學校資訊（可從 config 讀取）──

SCHOOL_DEFAULTS = {
    "school_name": "○○",
    "chair": "林甘偉",
    "recorder": "康雲昇",
    "location": "2F會議室",
}


# ── 工具函數 ──

def get_file_date(filepath: str) -> str:
    try:
        st = os.stat(filepath)
        ts = getattr(st, "st_birthtime", None) or st.st_mtime
        return datetime.fromtimestamp(ts).strftime("%Y-%m-%d")
    except Exception:
        return datetime.now().strftime("%Y-%m-%d")


def mask_name(name: str) -> str:
    chars = list(name)
    if len(chars) == 3:
        chars[1] = "○"
    elif len(chars) == 4:
        chars[1] = "○"
        chars[2] = "○"
    return "".join(chars)


# ── Step 1: Whisper ──

def step_transcribe(audio_path: str, tmp_dir: str) -> str:
    print("🎙️ [Step 1] Whisper 轉逐字稿 (medium) ...")
    result = subprocess.run(
        ["whisper", audio_path, "--model", "medium", "--language", "zh",
         "--output_dir", tmp_dir, "--output_format", "txt"],
        capture_output=True, text=True, timeout=600,
    )
    if result.returncode != 0:
        print(f"  ❌ Whisper 失敗: {result.stderr}", file=sys.stderr)
        sys.exit(1)

    txt_name = os.path.splitext(os.path.basename(audio_path))[0] + ".txt"
    txt_path = os.path.join(tmp_dir, txt_name)
    print(f"  ✅ 逐字稿完成")
    return txt_path


# ── Step 2: 存逐字稿到 Obsidian ──

def step_save_transcript(txt_path: str, student_name: str,
                         meeting_date: str, file_date: str) -> tuple:
    print("💾 [Step 2] 存逐字稿到 Obsidian ...")
    os.makedirs(TRANSCRIPT_DIR, exist_ok=True)

    filename = f"{file_date}-IEP會議逐字稿-{mask_name(student_name)}.md"
    dest = os.path.join(TRANSCRIPT_DIR, filename)

    with open(txt_path, "r", encoding="utf-8") as f:
        transcript = f.read()

    with open(dest, "w", encoding="utf-8") as f:
        f.write(f"---\ntype: transcript\ndate: {file_date}\n")
        f.write(f"student: {mask_name(student_name)}\nmeeting_date: {meeting_date}\n")
        f.write(f"source: whisper-medium\ntags: [IEP, 會議逐字稿]\n---\n\n")
        f.write(f"# IEP 會議逐字稿 — {mask_name(student_name)}\n\n")
        f.write(f"會議日期：{meeting_date}\n\n---\n\n")
        f.write(transcript)

    print(f"  ✅ {dest}")
    return dest, transcript


# ── Step 3: LLM 分析 ──

def step_ai_analyze(transcript: str, meeting_type: str,
                    student_name: str, meeting_date: str) -> dict:
    print("🤖 [Step 3] AI 分析逐字稿 ...")

    if meeting_type == "期初擬定":
        discussion_guide = """(一) 學生能力現況與需求評估。
(二) 本學期特教課程規劃討論。
(三) 預計之教育目標之討論。
(四) 討論教學及支持策略。
(五) 具情緒行為問題學生之行為功能分析及介入策略討論。（有需求者詳填）
(六) 有轉銜需求學生之轉銜服務討論。（有需求者詳填）
(七) 其他。"""
    else:
        discussion_guide = """(一) (本學期)學生能力現況的改變。
(二) (本學期)各領域的學習結果及行為處理成效。
(三) (下學期)學生特殊教育需求分析討論。
(四) (下學期)特殊教育課程規劃、相關服務及支持策略之討論。
(五) 相關服務及支持策略之討論。
(六) 其他。"""

    prompt = f"""你是一位資深特教教師，正在撰寫 IEP 會議記錄。

## 會議資訊
- 會議類型：{meeting_type}
- 學生姓名：{student_name}
- 會議日期：{meeting_date}

## 逐字稿
{transcript}

## 任務

根據逐字稿內容，產出以下 JSON（只輸出 JSON，不要其他文字）：

```json
{{
  "discussion": "討論內容摘要如下：\\n{discussion_guide[:20]}...(依架構撰寫完整內容)",
  "resolution": "1. 決議一\\n2. 決議二\\n...",
  "attendees": {{
    "admin": ["從逐字稿辨識的行政人員"],
    "parents": ["家長或照顧者"],
    "regular_teachers": ["普通班教師"],
    "special_ed_teachers": ["特教教師"],
    "professionals": ["專業人員，如語言治療師"],
    "assistants": ["助理人員"]
  }}
}}
```

## 討論內容架構（必須依此順序撰寫）

{discussion_guide}

## 撰寫原則

1. 從逐字稿提取實質內容，絕不編造
2. 用專業特教用語潤飾口語表達（例：「不太行」→「表現有待加強」）
3. 繁體中文
4. 如果是合開會議（期末+期初），只提取屬於「{meeting_type}」的部分
5. 決議要具體、可執行
6. 每個討論項目用編號和小標題，段落分明
7. 出席者如果從逐字稿無法確認，留空陣列"""

    env = os.environ.copy()
    env.pop("ANTHROPIC_API_KEY", None)

    result = subprocess.run(
        ["claude", "-p"],
        input=prompt,
        capture_output=True, text=True, timeout=600, env=env,
    )

    if result.returncode != 0:
        print(f"  ⚠️ Claude CLI 失敗 (code {result.returncode})，嘗試 Codex...", file=sys.stderr)
        result = subprocess.run(
            ["codex", "--quiet", "--full-auto"],
            input=prompt,
            capture_output=True, text=True, timeout=600, env=env,
        )

    response = result.stdout.strip()
    if not response:
        print("  ❌ LLM 無回應", file=sys.stderr)
        sys.exit(1)

    # 提取 JSON
    import re
    match = re.search(r'\{[\s\S]*\}', response)
    if match:
        try:
            data = json.loads(match.group())
            print("  ✅ AI 分析完成")
            return data
        except json.JSONDecodeError:
            pass

    print(f"  ❌ 無法解析 JSON，原始回應：\n{response[:500]}", file=sys.stderr)
    sys.exit(1)


# ── Step 4: 生成 .docx ──

def step_generate(ai_result: dict, args, file_date: str) -> str:
    print("📝 [Step 4] 從零生成會議記錄 .docx ...")

    from iep_meeting_generator import generate_meeting_record

    # 組裝完整資料
    semester = args.semester if hasattr(args, "semester") and args.semester else 1
    data = {
        "school_name": SCHOOL_DEFAULTS["school_name"],
        "academic_year": args.academic_year or "114",
        "semester": semester,
        "meeting_type": "擬訂" if args.meeting_type == "期初擬定" else "檢討",
        "student_name": args.student_name,
        "meeting_date": args.meeting_date,
        "location": SCHOOL_DEFAULTS["location"],
        "chair": SCHOOL_DEFAULTS["chair"],
        "recorder": SCHOOL_DEFAULTS["recorder"],
        "discussion": ai_result.get("discussion", ""),
        "resolution": ai_result.get("resolution", ""),
        "attendees": ai_result.get("attendees", {}),
    }

    masked = mask_name(args.student_name)
    output_filename = f"{file_date}-{masked}-IEP{args.meeting_type}會議記錄.docx"
    output_path = os.path.join(args.output_dir, output_filename)

    generate_meeting_record(data, output_path)
    print(f"  ✅ {output_path}")
    return output_path


# ── Main ──

def main():
    parser = argparse.ArgumentParser(description="IEP 會議記錄一鍵 pipeline")
    parser.add_argument("audio", help="錄音檔路徑 (.m4a/.mp3/.wav)")
    parser.add_argument("--student-name", required=True)
    parser.add_argument("--meeting-date", required=True)
    parser.add_argument("--meeting-type", required=True, choices=["期初擬定", "期末檢討"])
    parser.add_argument("--academic-year", default="114", help="學年度（預設 114）")
    parser.add_argument("--semester", type=int, default=1, help="學期（預設 1）")
    parser.add_argument("--output-dir", default=os.path.expanduser("~/Desktop"))
    parser.add_argument("--skip-whisper", action="store_true")
    parser.add_argument("--transcript", help="已有的逐字稿路徑")

    args = parser.parse_args()
    file_date = get_file_date(args.audio)
    tmp_dir = tempfile.mkdtemp(prefix="iep_")

    print(f"\n{'='*60}")
    print(f"🏫 IEP 會議記錄 Pipeline")
    print(f"   學生：{args.student_name}")
    print(f"   日期：{args.meeting_date}")
    print(f"   類型：{args.meeting_type}")
    print(f"   學年度：{args.academic_year} 第 {args.semester} 學期")
    print(f"{'='*60}\n")

    # Step 1: Whisper
    if args.skip_whisper and args.transcript:
        with open(args.transcript, "r", encoding="utf-8") as f:
            transcript = f.read()
        obsidian_path = "(已跳過)"
    else:
        txt_path = step_transcribe(args.audio, tmp_dir)
        obsidian_path, transcript = step_save_transcript(
            txt_path, args.student_name, args.meeting_date, file_date
        )

    # Step 3: AI 分析
    ai_result = step_ai_analyze(
        transcript, args.meeting_type,
        args.student_name, args.meeting_date,
    )

    # Step 4: 生成 .docx
    output_path = step_generate(ai_result, args, file_date)

    # 總結
    print(f"\n{'='*60}")
    print(f"✅ Pipeline 完成！")
    print(f"   逐字稿：{obsidian_path}")
    print(f"   會議記錄：{output_path}")
    print(f"{'='*60}\n")

    shutil.rmtree(tmp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
