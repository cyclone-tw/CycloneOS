#!/usr/bin/env python3
"""
analyze_meeting.py — 將逐字稿 + 模板結構丟給 LLM，產出填入指令 JSON。

Usage:
    python3 analyze_meeting.py <transcript.txt> <template_structure.json> \
        --meeting-type [期初擬定|期末檢討] \
        --student-name <學生姓名> \
        --meeting-date <會議日期> \
        [--output fill_instructions.json]
"""

import json
import sys
import os
import subprocess
import argparse


def build_prompt(transcript: str, structure: dict, meeting_type: str,
                 student_name: str, meeting_date: str) -> str:
    """組裝 prompt，讓 LLM 分析逐字稿並產出填入指令。"""

    # 精簡結構描述，只保留需要填入的部分
    fillable_parts = []
    for elem in structure.get("elements", []):
        if elem["type"] == "table":
            for row in elem["data"]:
                for cell in row["cells"]:
                    if cell["is_empty"]:
                        fillable_parts.append({
                            "type": "table",
                            "table_index": elem["index"],
                            "row": row["row"],
                            "col": cell["col"],
                            "context": f"表格{elem['index']}，第{row['row']}行第{cell['col']}列",
                        })
                    elif "討論內容" in cell["text"] or "會議決議" in cell["text"]:
                        fillable_parts.append({
                            "type": "table",
                            "table_index": elem["index"],
                            "row": row["row"],
                            "col": cell["col"],
                            "context": cell["text"][:50],
                            "current_text": cell["text"],
                        })

    structure_summary = json.dumps(fillable_parts, ensure_ascii=False, indent=2)

    prompt = f"""你是一位資深特教教師，正在處理 IEP 會議記錄。

## 任務

根據以下會議錄音逐字稿，分析並產出結構化的會議記錄內容。
會議類型：{meeting_type}
學生姓名：{student_name}
會議日期：{meeting_date}

## 逐字稿

{transcript}

## 模板中需要填入的位置

以下是模板中需要填入內容的表格位置：

{structure_summary}

## 輸出要求

請以 JSON 格式輸出填入指令。格式如下：

```json
{{
  "meeting_summary": {{
    "meeting_type": "{meeting_type}",
    "student_name": "{student_name}",
    "meeting_date": "{meeting_date}",
    "key_points": ["重點1", "重點2", ...]
  }},
  "fills": [
    {{
      "type": "table",
      "table_index": 1,
      "row": 2,
      "col": 0,
      "action": "replace",
      "text": "討論內容摘要如下：\\n1. ..."
    }},
    {{
      "type": "table",
      "table_index": 1,
      "row": 4,
      "col": 0,
      "action": "replace",
      "text": "1. 決議事項一...\\n2. 決議事項二..."
    }}
  ]
}}
```

## 撰寫原則

{"期初擬定" if meeting_type == "期初擬定" else "期末檢討"}會議記錄的討論事項應包含：

{"- (一) 學生能力現況與需求評估" if meeting_type == "期初擬定" else "- (一) (本學期)學生能力現況的改變"}
{"- (二) 本學期特教課程規劃討論" if meeting_type == "期初擬定" else "- (二) (本學期)各領域的學習結果及行為處理成效"}
{"- (三) 預計之教育目標之討論" if meeting_type == "期初擬定" else "- (三) (下學期)學生特殊教育需求分析討論"}
{"- (四) 討論教學及支持策略" if meeting_type == "期初擬定" else "- (四) (下學期)特殊教育課程規劃、相關服務及支持策略之討論"}
{"- (五) 具情緒行為問題學生之行為功能分析及介入策略討論（有需求者務必詳填）" if meeting_type == "期初擬定" else "- (五) 相關服務及支持策略之討論"}
{"- (六) 有轉銜需求學生之轉銜服務討論（跨教育階段/跨學習階段轉銜必填）" if meeting_type == "期初擬定" else "- (六) 其他"}

## 注意事項

1. 從逐字稿中提取實質內容，不要編造
2. 用專業的特教用語潤飾口語表達
3. 保持繁體中文
4. 如果逐字稿中包含多次會議（合開），只提取屬於「{meeting_type}」的部分
5. 決議要具體、可執行
6. 只輸出 JSON，不要有其他文字

請直接輸出 JSON："""

    return prompt


def call_llm(prompt: str, provider: str = "claude") -> str:
    """呼叫 LLM CLI 產出分析結果。"""
    if provider == "claude":
        cmd = ["claude", "-p"]
    elif provider == "codex":
        cmd = ["codex", "--quiet", "--full-auto"]
    else:
        raise ValueError(f"Unknown provider: {provider}")

    env = os.environ.copy()
    env.pop("ANTHROPIC_API_KEY", None)

    result = subprocess.run(
        cmd,
        input=prompt,
        capture_output=True,
        text=True,
        timeout=600,
        env=env,
    )

    if result.returncode != 0:
        print(f"LLM error: {result.stderr}", file=sys.stderr)
        return ""

    return result.stdout.strip()


def extract_json(text: str) -> dict:
    """從 LLM 回應中提取 JSON。"""
    # 嘗試直接解析
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # 嘗試從 markdown code block 中提取
    import re
    match = re.search(r'```(?:json)?\s*\n?(.*?)```', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    # 嘗試找到第一個 { 和最後一個 }
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end != -1:
        try:
            return json.loads(text[start:end + 1])
        except json.JSONDecodeError:
            pass

    print("Warning: Could not parse LLM response as JSON", file=sys.stderr)
    return {"fills": [], "error": "Failed to parse LLM response"}


def main():
    parser = argparse.ArgumentParser(description="分析 IEP 會議逐字稿")
    parser.add_argument("transcript", help="逐字稿檔案路徑")
    parser.add_argument("structure", help="模板結構 JSON 檔案路徑")
    parser.add_argument("--meeting-type", required=True, choices=["期初擬定", "期末檢討"])
    parser.add_argument("--student-name", required=True)
    parser.add_argument("--meeting-date", required=True)
    parser.add_argument("--provider", default="claude", choices=["claude", "codex"])
    parser.add_argument("--output", help="輸出 JSON 路徑")

    args = parser.parse_args()

    # 讀取逐字稿
    with open(args.transcript, "r", encoding="utf-8") as f:
        transcript = f.read()

    # 讀取模板結構
    with open(args.structure, "r", encoding="utf-8") as f:
        structure = json.load(f)

    # 組裝 prompt
    prompt = build_prompt(
        transcript, structure, args.meeting_type,
        args.student_name, args.meeting_date,
    )

    print(f"Prompt length: {len(prompt)} chars", file=sys.stderr)
    print(f"Calling {args.provider}...", file=sys.stderr)

    # 呼叫 LLM
    response = call_llm(prompt, args.provider)

    if not response:
        print("Error: Empty response from LLM", file=sys.stderr)
        sys.exit(1)

    # 提取 JSON
    result = extract_json(response)

    output = json.dumps(result, ensure_ascii=False, indent=2)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output)
        print(f"Fill instructions saved to: {args.output}", file=sys.stderr)
    else:
        print(output)


if __name__ == "__main__":
    main()
