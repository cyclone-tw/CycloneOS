---
type: design-spec
date: 2026-04-17
topic: session-end-flush
status: pending-user-review
tags: [cycloneos, hooks, session-log, ai-portability, raymond-benchmark]
---

# SessionEnd Flush — 自動萃取 session 交接單

## 1. 背景

### 現況問題

- `~/.cyclone/scripts/hooks/save-session.sh` 在 SessionEnd 只寫統計殼（操作數 + 最後 10 筆 tool call），不讀 transcript
- 驗證樣本：2026-04-17 session 7/8/9 全是空殼，下一個 session 開工時無法接續
- CycloneOS `CLAUDE.md` 的 `🔜 Next Session` 區塊為手動維護，容易漏寫

### 對照雷小蒙（Raymond 三十）架構

雷小蒙的 `session-end-flush.sh` 在 SessionEnd 讀 transcript、LLM 萃取重點、寫 daily log。這是他跨 session 不失憶的核心機制。本 spec 實作等效功能，但加上 provider 抽象層以符合 CycloneOS 「AI Agent 無關性」最高原則。

### 關鍵已驗證事實（2026-04-17 smoke test）

- SessionEnd hook stdin 包含 `transcript_path`（現有 `save-session.sh` 的註解錯誤）
- `claude -p --model haiku` headless 模式可於 ~19 秒內對 130KB transcript 萃取出可用的 YAML 摘要
- 子 `claude -p` 進程會觸發父 Claude Code 的所有 hook（污染 session log、audit.jsonl）——必須加遞迴 guard
- `gemini` 與 `codex` CLI 已安裝於使用者機器，抽象層可實測

## 2. 目標

1. SessionEnd 自動產出**有內容的交接單**：summary / decisions / pending / knowledge 四欄
2. LLM 呼叫走抽象層，**不綁死 Claude**：透過 `CYCLONE_AI_PROVIDER` env 切換（claude / gemini / codex / openai-api / ollama）
3. 不破壞既有流程：手動 `/session-log` 保留，既有 hook 加最小 guard
4. SessionStart Daily Brief 升級，顯示上次 session 的 `pending` → 新 session 開場即有交接點

## 3. 檔案組織

```
~/.cyclone/scripts/
├── hooks/
│   ├── save-session.sh          ← 重寫：萃取版，保留 fallback 統計殼
│   ├── session-start.sh         ← 改：加 guard + Daily Brief 顯示上次 pending
│   ├── context-inject.sh        ← 改：加 guard
│   ├── audit-log.sh             ← 改：加 guard
│   └── pre-compact-snapshot.sh  ← 改：加 guard
└── lib/                          ← 新增
    ├── ai-extract.sh            ← Provider 抽象層
    └── transcript-parse.sh      ← Transcript 格式 adapter
```

## 4. 資料流（SessionEnd 觸發）

1. Hook 自 stdin 收到 `{transcript_path, session_id, reason, cwd, hook_event_name}`
2. **Guard check**：若 `$CYCLONE_IN_HOOK` 已設 → `exit 0`（阻斷遞迴）
3. `export CYCLONE_IN_HOOK=1`；將萃取邏輯用 `nohup … &` 背景化（使用者可立即關 terminal）
4. `sleep 0.5` 等 Claude Code 完成 transcript flush
5. 呼叫 `lib/transcript-parse.sh <transcript_path> claude-code`
   - stdout：每行 `U: <text>` / `A: <text>` / `A: [ToolName]`，單行截斷 400 字
6. 呼叫 `lib/ai-extract.sh`（stdin 輸入 prompt+sample，stdout 輸出 YAML）
   - 內部硬限制：`timeout 50` + `--max-budget-usd 0.2`
7. **成功路徑**：YAML parse 通過 → 組 frontmatter + body → Write Obsidian `YYYY-MM-DD-session-N-auto.md`
8. **失敗路徑**：timeout / exit≠0 / YAML invalid → fallback 規則式（等同現行統計殼），frontmatter 標 `extraction: failed` + reason

## 5. Provider 抽象層

### `lib/ai-extract.sh`

- stdin：完整 prompt（schema 指示 + transcript sample）
- stdout：YAML（無 markdown fence）
- env：`CYCLONE_AI_PROVIDER`（預設 `claude`）

```bash
#!/bin/bash
PROVIDER="${CYCLONE_AI_PROVIDER:-claude}"
case "$PROVIDER" in
  claude)
    exec timeout 50 claude -p --model haiku \
      --disable-slash-commands --max-budget-usd 0.2 \
      --append-system-prompt "你是 session log 萃取器，嚴格只輸出 YAML，不要 markdown fence"
    ;;
  gemini)
    exec timeout 50 gemini -p "$(cat)"
    ;;
  codex)
    exec timeout 50 codex exec "$(cat)"
    ;;
  openai-api|ollama)
    echo "Provider $PROVIDER not implemented in v1" >&2
    exit 2
    ;;
  *)
    echo "Unknown CYCLONE_AI_PROVIDER: $PROVIDER" >&2
    exit 2
    ;;
esac
```

**v1 交付**：`claude` 完整實作；`gemini` / `codex` 可跑但 prompt 傳遞方式未精調；`openai-api` / `ollama` 回 exit 2（讓 fallback 接手），**證明介面 ready**。

### `lib/transcript-parse.sh`

- `$1 = transcript_path`，`$2 = format`（預設 `claude-code`）
- stdout：每行一條對話樣本

```bash
#!/bin/bash
TRANSCRIPT="$1"; FORMAT="${2:-claude-code}"
case "$FORMAT" in
  claude-code)
    jq -r '
      if .type=="user" then
        "U: " + (
          if (.message.content | type) == "string" then .message.content
          else (.message.content | map(.text // .content // "[非文字]") | join(" | ")) end
          | .[0:400]
        )
      elif .type=="assistant" then
        "A: " + (.message.content | map(
          if .type=="text" then .text
          elif .type=="tool_use" then "[\(.name)]"
          else "" end
        ) | join(" ") | .[0:400])
      else empty end
    ' "$TRANSCRIPT"
    ;;
  *)
    echo "Format $FORMAT not supported" >&2
    exit 2
    ;;
esac
```

## 6. 萃取 Prompt 與 YAML Schema

輸入 claude 的 prompt 結構：

```
你是 session log 萃取器。以下是 Claude Code session 的對話紀錄（U=使用者, A=assistant, [ToolName]=工具呼叫）。

請用繁體中文輸出 YAML，嚴格照以下 schema，不要 markdown fence：

summary: 一段話總結這次 session 做了什麼（40-80 字）
decisions:
  - 關鍵決策（沒有就空陣列 []）
pending:
  - 未完成項（沒有就空陣列 []）
knowledge:
  - 學到的新知識（沒有就空陣列 []）

--- 對話開始 ---
<transcript sample>
--- 對話結束 ---
```

## 7. Session Log 檔案格式

### 檔名規則（決策：自動版加 `-auto` 後綴）

- 手動 `/session-log`：`YYYY-MM-DD-session-N.md`（沿用既有）
- 自動 SessionEnd：`YYYY-MM-DD-session-N-auto.md`

`N` 為當日檔案序號，手動與自動**共用同一計數器**（自動版取下一號加 `-auto`）。

### Frontmatter（自動版）

```yaml
---
type: session-log
date: YYYY-MM-DD
session: N
source: cycloneos
auto-generated: true
extraction: success | failed
provider: claude-haiku-4-5 | gemini | codex | ...
extraction-ms: 19420
tags: [cyclone, session-log, auto]
---
```

### Body（extraction: success）

```markdown
# YYYY-MM-DD Session N（自動交接單）

## Summary
<YAML summary 欄>

## Decisions
- <item 1>
- <item 2>

## Pending
- <item 1>

## Knowledge
- <item 1>

## 統計
- 今日操作數：<N>
- Session 結束時間：<HH:MM:SS>
- 萃取耗時：<ms>
- Model：<provider>
```

### Body（extraction: failed）

第一行警示：`> ⚠️ 萃取失敗（reason: <timeout|parse-error|provider-not-ready|...>），請手動檢視 transcript: <path>`

下接現行的「統計 + 最近 10 筆操作」殼。**保證永不丟失 session log**。

## 8. SessionStart Daily Brief 升級

現況（`session-start.sh`）：列最近 3 個 session log 檔名。

升級行為：
- 掃當日或前日 session log 目錄，取最新一個（手動 `-N.md` 優先於 `-N-auto.md`，因為手動版較深度）
- 若是自動版：解析 `## Pending` 與 `## Summary` 區塊
- 若是手動版：解析 `## 待辦 / 下次接續` 與 `## 過程摘要` 區塊
- Daily Brief 新增一段：

```
最近 Session（2026-04-17-session-12-auto.md）：
  Summary：處理 CycloneOS 架構優化討論，決定走 A' 方案…
  未完成：
    - Spec doc 還沒寫完
    - 實作 plan 還沒產
```

失敗（檔案不存在、解析失敗）：降級為既有行為（只列檔名）。

## 9. 錯誤處理矩陣

| 失敗點 | 行為 | frontmatter reason |
|:--|:--|:--|
| `transcript_path` 不存在 | fallback 統計殼 | `transcript-missing` |
| `jq` 非 0 exit | fallback 統計殼 | `parse-error` |
| `ai-extract.sh` timeout（50s） | fallback 統計殼 | `timeout` |
| `ai-extract.sh` exit 2（provider 未實作） | fallback 統計殼 | `provider-not-ready` |
| `ai-extract.sh` exit 非 0/2 | fallback 統計殼 | `provider-error` |
| YAML parse 失敗 | fallback 統計殼 | `yaml-invalid` |
| 背景 `nohup … &` 啟動失敗 | 頂層 hook 直接寫最小統計殼 | — |

## 10. 測試計畫

| 測試 | 方法 | 通過條件 |
|:--|:--|:--|
| Smoke：headless 能跑 | ✅ 已過（2026-04-17，19s，YAML 格式正確） | — |
| E2E：真實 `/clear` 觸發 | 跑小 session → `/clear` → 等 60s | `-auto.md` 四欄俱全 |
| Guard：遞迴阻斷 | 子 `claude -p` 於 hook 內呼叫 | 不產生二代 `-auto.md` |
| Fallback：provider 缺失 | `CYCLONE_AI_PROVIDER=ollama` 強制失敗 | 統計殼 + `extraction: failed; reason: provider-not-ready` |
| Provider swap：gemini | `CYCLONE_AI_PROVIDER=gemini` 跑 | 產出檔案（品質可能不如 claude，記錄品質差異） |
| Daily Brief 升級 | 下次 session 開場 | 顯示 pending 區塊 |

## 11. Rollout 順序

1. 清 smoke test 污染檔（session-10/11/12 空殼）
2. `mkdir -p ~/.cyclone/scripts/lib/`
3. 寫 `lib/ai-extract.sh`（claude 完整 + 其他 stub/exec）
4. 寫 `lib/transcript-parse.sh`（claude-code format）
5. 所有 hook 開頭加 `CYCLONE_IN_HOOK` guard（5 個檔）
6. 重寫 `save-session.sh`：背景化 + 萃取流程 + fallback
7. 升級 `session-start.sh`：Daily Brief 讀最新 log
8. E2E 測試：小 session → `/clear` → 檢查產出
9. Provider swap smoke：切 `gemini` 跑一次、切 `ollama` 跑一次

每步有驗證指令，失敗可回退（git diff 局部 revert）。

## 12. 非目標（本次不做）

- `UserPromptSubmit` context-inject 升級（讀最近 3 天 log 注入）→ 獨立 task
- `PreCompact` snapshot 的萃取升級 → 獨立 task
- `~/.claude/` → `000_Agent/` 跨裝置可攜遷移 → 獨立大 task
- Discord Bot session log 整合 → 不在此範圍
- 手動 `/session-log` template 調整 → 不在此範圍
- `openai-api` / `ollama` provider 完整實作（stub 即可）→ 未來 task

## 13. 成功指標

- 下次 session 產出的 `-auto.md` 不再是純統計殼（summary/decisions/pending/knowledge 至少有 2 欄有內容）
- 任意抓一個 `-auto.md` 可讀出「上次做什麼、還沒做完什麼」
- `CYCLONE_AI_PROVIDER=ollama` 跑一次 → fallback 正確觸發、frontmatter 有 `provider-not-ready`，**證明抽象層有效**
- SessionStart Daily Brief 顯示上次 pending，不用翻檔案即可接手

## 14. 未決事項（留給 implementation plan）

- `ai-extract.sh` 的 `--append-system-prompt` 字串精調（目前草擬版）
- `session-start.sh` 的 YAML 解析細節（用 `yq`？純 `sed`？）：取決於 `yq` 是否已安裝
- `nohup` 背景化的 stdout/stderr 導向（`/dev/null` vs log file）
- E2E 測試的小 session 腳本內容
