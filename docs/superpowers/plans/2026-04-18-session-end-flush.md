# SessionEnd Flush Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite CycloneOS SessionEnd hook so it extracts a structured YAML交接單 (summary / decisions / pending / knowledge) from the transcript, via an AI-provider-agnostic helper, with a fallback to the current stats shell on any failure.

**Architecture:** SessionEnd hook → guard (`$CYCLONE_IN_HOOK`) → background `nohup` → `lib/transcript-parse.sh` (jq) → `lib/ai-extract.sh` (provider adapter, default `claude-haiku`) → write `YYYY-MM-DD-session-N-auto.md`. SessionStart Daily Brief also gets upgraded to parse the latest log's Summary + Pending. All 5 existing hooks get the `CYCLONE_IN_HOOK` guard so child `claude -p` processes never recurse.

**Tech Stack:** Bash, jq, `claude -p --model haiku` (headless), YAML, Markdown. Optional future adapters: gemini-cli, codex, openai-api, ollama.

**Spec:** `docs/superpowers/specs/2026-04-17-session-end-flush-design.md`

---

## Context Every Task Needs

### Source-of-truth vs live copy

Scripts exist in two places:

| Location | Role |
|:--|:--|
| `~/Github/01-Repo/cyclone-dotfiles/cyclone/scripts/` | **Source of truth** (git-tracked, committed) |
| `~/.cyclone/scripts/` | **Live copy** (what Claude Code actually loads via settings.json) |

**Every task edits both.** Suggested workflow per task:
1. Edit live copy first (so tests run immediately against real path)
2. Mirror back to dotfiles: `cp -r ~/.cyclone/scripts/<changed-dir>/ ~/Github/01-Repo/cyclone-dotfiles/cyclone/scripts/`
3. Run tests in `~/.cyclone/scripts/tests/`
4. Git add + commit in `~/Github/01-Repo/cyclone-dotfiles/`

### File structure (final)

```
~/.cyclone/scripts/                       (mirror in cyclone-dotfiles)
├── hooks/
│   ├── save-session.sh                   (rewrite in Task 5)
│   ├── session-start.sh                  (modify in Tasks 1 + 6)
│   ├── context-inject.sh                 (modify in Task 1)
│   ├── audit-log.sh                      (modify in Task 1)
│   └── pre-compact-snapshot.sh           (modify in Task 1)
├── lib/                                   (new, Tasks 2–4)
│   ├── ai-extract.sh
│   └── transcript-parse.sh
└── tests/                                 (new, Task 0)
    ├── fixtures/
    │   └── sample-transcript.jsonl
    ├── test-guards.sh
    ├── test-transcript-parse.sh
    ├── test-ai-extract.sh
    ├── test-save-session.sh
    ├── test-session-start.sh
    └── run-all.sh
```

### Git commit convention

Commit in `~/Github/01-Repo/cyclone-dotfiles/` at the end of every task. Use conventional commits (`feat:`, `fix:`, `chore:`, `docs:`) with `(cyclone)` scope since dotfiles tracks multiple tool configs.

---

## Task 0: Scaffold test harness + fixture

**Files:**
- Create: `~/.cyclone/scripts/tests/run-all.sh`
- Create: `~/.cyclone/scripts/tests/fixtures/sample-transcript.jsonl`
- Mirror: `~/Github/01-Repo/cyclone-dotfiles/cyclone/scripts/tests/*`

**Purpose:** A bash-only test harness (no bats/pytest needed). Each test file is a standalone bash script that exits 0 on pass and non-zero on fail. `run-all.sh` runs them all and reports.

### Steps

- [ ] **Step 1: Create test directory structure**

```bash
mkdir -p ~/.cyclone/scripts/tests/fixtures
```

- [ ] **Step 2: Create the fixture — a minimal transcript jsonl**

Write `~/.cyclone/scripts/tests/fixtures/sample-transcript.jsonl` with exactly these 6 lines (JSON-per-line):

```
{"type":"user","message":{"role":"user","content":"幫我看 CycloneOS 架構"}}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"我先讀 README"}]}}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","name":"Read","input":{"file_path":"/tmp/readme.md"}}]}}
{"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"x","content":"# README content"}]}}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"看到 README 了，架構走 Next.js"}]}}
{"type":"user","message":{"role":"user","content":"好，幫我寫個 plan"}}
```

Important: ensure no trailing newline on the last line, and every line is valid JSON (use `jq -c . < file > file.tmp && mv file.tmp file` to verify + re-compact if needed).

- [ ] **Step 3: Create `run-all.sh`**

Write `~/.cyclone/scripts/tests/run-all.sh`:

```bash
#!/bin/bash
# Run all cyclone hook tests. Exit 0 if all pass, 1 if any fails.

cd "$(dirname "$0")" || exit 1
FAIL=0
PASS=0
for t in test-*.sh; do
  [ -f "$t" ] || continue
  echo "--- $t ---"
  if bash "$t"; then
    echo "PASS: $t"
    PASS=$((PASS + 1))
  else
    echo "FAIL: $t"
    FAIL=$((FAIL + 1))
  fi
  echo ""
done
echo "================"
echo "Passed: $PASS"
echo "Failed: $FAIL"
[ "$FAIL" -eq 0 ]
```

Make executable: `chmod +x ~/.cyclone/scripts/tests/run-all.sh`

- [ ] **Step 4: Verify fixture parses as valid jsonl**

```bash
jq -c . ~/.cyclone/scripts/tests/fixtures/sample-transcript.jsonl | wc -l
```

Expected: `6` (all 6 lines parse without error)

- [ ] **Step 5: Mirror to dotfiles**

```bash
mkdir -p ~/Github/01-Repo/cyclone-dotfiles/cyclone/scripts/tests
cp -r ~/.cyclone/scripts/tests/ ~/Github/01-Repo/cyclone-dotfiles/cyclone/scripts/
```

- [ ] **Step 6: Commit**

```bash
cd ~/Github/01-Repo/cyclone-dotfiles
git add cyclone/scripts/tests/
git commit -m "chore(cyclone): add test harness for hook scripts

Bash-only test runner (run-all.sh). Each test file is a
standalone bash script that exits 0 on pass. Includes a
minimal 6-line transcript fixture for unit testing
transcript-parse.sh and save-session.sh."
```

---

## Task 1: Add CYCLONE_IN_HOOK guard to 5 existing hooks

**Why first:** Subsequent tasks spawn child `claude -p` processes during tests. Without this guard, they recursively trigger SessionEnd → pollute session log dir (we already saw this in smoke test).

**Files:**
- Modify: `~/.cyclone/scripts/hooks/save-session.sh` (after line 2, before `command -v jq` check)
- Modify: `~/.cyclone/scripts/hooks/session-start.sh` (after line 2)
- Modify: `~/.cyclone/scripts/hooks/context-inject.sh` (after line 4)
- Modify: `~/.cyclone/scripts/hooks/audit-log.sh` (after line 3)
- Modify: `~/.cyclone/scripts/hooks/pre-compact-snapshot.sh` (after line 3)
- Create: `~/.cyclone/scripts/tests/test-guards.sh`

### Steps

- [ ] **Step 1: Write the failing test**

Create `~/.cyclone/scripts/tests/test-guards.sh`:

```bash
#!/bin/bash
# Verify all 5 hooks exit 0 with no side effects when CYCLONE_IN_HOOK=1
set -u

HOOKS_DIR="$HOME/.cyclone/scripts/hooks"
HOOKS=(save-session.sh session-start.sh context-inject.sh audit-log.sh pre-compact-snapshot.sh)
FAIL=0

for h in "${HOOKS[@]}"; do
  OUT=$(CYCLONE_IN_HOOK=1 bash "$HOOKS_DIR/$h" </dev/null 2>&1)
  EXIT=$?
  if [ "$EXIT" -ne 0 ]; then
    echo "  guard FAIL on $h: exit $EXIT"
    FAIL=1
  fi
  if [ -n "$OUT" ]; then
    echo "  guard FAIL on $h: produced output when guarded:"
    echo "$OUT" | head -3 | sed 's/^/    /'
    FAIL=1
  fi
done

exit $FAIL
```

Make executable: `chmod +x ~/.cyclone/scripts/tests/test-guards.sh`

- [ ] **Step 2: Run the test — expect FAIL**

```bash
bash ~/.cyclone/scripts/tests/test-guards.sh
```

Expected: prints `guard FAIL on <hook>...` for multiple hooks, exit 1 (because hooks currently have no guard — `session-start.sh` will print the Daily Brief, `pre-compact-snapshot.sh` will write a file, etc.).

- [ ] **Step 3: Add guard to `audit-log.sh`**

Edit `~/.cyclone/scripts/hooks/audit-log.sh`. After line 3 (the header comments), insert:

```bash

# Guard: prevent recursion from child claude -p processes
[ -n "${CYCLONE_IN_HOOK:-}" ] && exit 0
```

So the top of the file reads:
```bash
#!/bin/bash
# CycloneOS PostToolUse Hook — records operations to audit log
# Uses jq -n for safe JSON construction (no injection)

# Guard: prevent recursion from child claude -p processes
[ -n "${CYCLONE_IN_HOOK:-}" ] && exit 0

command -v jq >/dev/null 2>&1 || exit 0
...
```

- [ ] **Step 4: Add the same guard to the other 4 hooks**

Apply the identical guard block (the 2-line comment + check) to:
- `~/.cyclone/scripts/hooks/session-start.sh` — insert after the existing header comment lines 1–2
- `~/.cyclone/scripts/hooks/context-inject.sh` — insert after header lines 1–4
- `~/.cyclone/scripts/hooks/pre-compact-snapshot.sh` — insert after header lines 1–3
- `~/.cyclone/scripts/hooks/save-session.sh` — insert after header lines 1–3 (BEFORE the existing `command -v jq` check)

- [ ] **Step 5: Run the test — expect PASS**

```bash
bash ~/.cyclone/scripts/tests/test-guards.sh
echo "exit: $?"
```

Expected: no output, exit 0.

- [ ] **Step 6: Sanity — verify hooks still work when NOT guarded**

```bash
bash ~/.cyclone/scripts/hooks/session-start.sh | head -3
```

Expected: shows `=== CycloneOS Daily Brief ===` (existing behavior preserved).

- [ ] **Step 7: Mirror to dotfiles**

```bash
cp -r ~/.cyclone/scripts/hooks/ ~/Github/01-Repo/cyclone-dotfiles/cyclone/scripts/
cp ~/.cyclone/scripts/tests/test-guards.sh ~/Github/01-Repo/cyclone-dotfiles/cyclone/scripts/tests/
```

- [ ] **Step 8: Commit**

```bash
cd ~/Github/01-Repo/cyclone-dotfiles
git add cyclone/scripts/hooks/ cyclone/scripts/tests/test-guards.sh
git commit -m "fix(cyclone): add CYCLONE_IN_HOOK guard to prevent hook recursion

Child claude -p processes spawned by future save-session.sh
would otherwise re-trigger SessionEnd and pollute the session
log dir (verified in 2026-04-17 smoke test producing session-10/11/12
empty shells). All 5 hooks now exit 0 immediately when the
env var is set, which save-session.sh will export before
spawning its extraction subprocess."
```

---

## Task 2: Create lib/transcript-parse.sh (claude-code format adapter)

**Files:**
- Create: `~/.cyclone/scripts/lib/transcript-parse.sh`
- Create: `~/.cyclone/scripts/tests/test-transcript-parse.sh`

**Interface:**
- Args: `$1 = transcript_path`, `$2 = format` (default `claude-code`)
- stdout: one line per turn. `U: <text>` for user, `A: <text>` for assistant text, `A: [ToolName]` for tool_use. Max 400 chars per line.
- Exit codes: 0 on success, 2 on missing file / unsupported format / missing jq.

### Steps

- [ ] **Step 1: Write the failing test**

Create `~/.cyclone/scripts/tests/test-transcript-parse.sh`:

```bash
#!/bin/bash
# Test lib/transcript-parse.sh against the 6-line fixture.
set -u

LIB="$HOME/.cyclone/scripts/lib/transcript-parse.sh"
FIXTURE="$HOME/.cyclone/scripts/tests/fixtures/sample-transcript.jsonl"
FAIL=0

assert_contains() {
  local needle="$1"; local haystack="$2"; local msg="$3"
  if echo "$haystack" | grep -qF "$needle"; then
    :
  else
    echo "  FAIL: $msg — expected to contain: $needle"
    FAIL=1
  fi
}

# Case 1: happy path — 6 fixture lines produce 5 output lines
# (6 inputs; only types user/assistant emit; all 6 are user or assistant)
OUT=$(bash "$LIB" "$FIXTURE" claude-code)
EXIT=$?
if [ "$EXIT" -ne 0 ]; then
  echo "  FAIL: exit code $EXIT on happy path"; FAIL=1
fi

LINES=$(echo "$OUT" | wc -l | tr -d ' ')
if [ "$LINES" -ne 6 ]; then
  echo "  FAIL: expected 6 output lines, got $LINES"
  echo "$OUT"
  FAIL=1
fi

assert_contains "U: 幫我看 CycloneOS 架構" "$OUT" "first user text"
assert_contains "A: 我先讀 README" "$OUT" "first assistant text"
assert_contains "A: [Read]" "$OUT" "tool_use as [Read]"
assert_contains "U: " "$OUT" "tool_result line prefixed U:"
assert_contains "# README content" "$OUT" "tool_result content"

# Case 2: nonexistent file → exit 2
if bash "$LIB" /tmp/definitely-not-a-file.jsonl claude-code >/dev/null 2>&1; then
  echo "  FAIL: expected exit 2 on missing file"; FAIL=1
fi

# Case 3: unsupported format → exit 2
if bash "$LIB" "$FIXTURE" weird-format >/dev/null 2>&1; then
  echo "  FAIL: expected exit 2 on unsupported format"; FAIL=1
fi

exit $FAIL
```

Make executable: `chmod +x ~/.cyclone/scripts/tests/test-transcript-parse.sh`

- [ ] **Step 2: Run the test — expect FAIL**

```bash
bash ~/.cyclone/scripts/tests/test-transcript-parse.sh
```

Expected: `FAIL: exit code 127 on happy path` (script doesn't exist yet) → exit 1.

- [ ] **Step 3: Create the lib script**

```bash
mkdir -p ~/.cyclone/scripts/lib
```

Write `~/.cyclone/scripts/lib/transcript-parse.sh`:

```bash
#!/bin/bash
# CycloneOS lib — transcript format adapter
# Usage: transcript-parse.sh <transcript_path> [format=claude-code]
# Output: one line per turn. U:/A: prefix, [ToolName] for tool_use.
# Exit: 0 ok, 2 error (missing file, missing jq, unsupported format)

set -u
TRANSCRIPT="${1:-}"
FORMAT="${2:-claude-code}"

if [ -z "$TRANSCRIPT" ] || [ ! -f "$TRANSCRIPT" ]; then
  echo "transcript-parse: file not found: ${TRANSCRIPT:-<empty>}" >&2
  exit 2
fi

command -v jq >/dev/null 2>&1 || { echo "transcript-parse: jq required" >&2; exit 2; }

case "$FORMAT" in
  claude-code)
    jq -r '
      if .type == "user" then
        "U: " + (
          if (.message.content | type) == "string" then .message.content
          else (.message.content | map(.text // .content // "[非文字]") | join(" | ")) end
          | .[0:400]
        )
      elif .type == "assistant" then
        "A: " + (.message.content | map(
          if .type == "text" then .text
          elif .type == "tool_use" then "[\(.name)]"
          else "" end
        ) | join(" ") | .[0:400])
      else empty end
    ' "$TRANSCRIPT"
    ;;
  *)
    echo "transcript-parse: format '$FORMAT' not supported in v1" >&2
    exit 2
    ;;
esac
```

Make executable: `chmod +x ~/.cyclone/scripts/lib/transcript-parse.sh`

- [ ] **Step 4: Run the test — expect PASS**

```bash
bash ~/.cyclone/scripts/tests/test-transcript-parse.sh
echo "exit: $?"
```

Expected: no FAIL lines, exit 0.

- [ ] **Step 5: Manual sanity — run against a real recent transcript**

```bash
REAL=$(ls -t ~/.claude/projects/-Users-cyclone-CycloneOS/*.jsonl | head -1)
bash ~/.cyclone/scripts/lib/transcript-parse.sh "$REAL" | head -5
```

Expected: 5 lines of `U:` / `A:` format, human-readable.

- [ ] **Step 6: Mirror + commit**

```bash
mkdir -p ~/Github/01-Repo/cyclone-dotfiles/cyclone/scripts/lib
cp ~/.cyclone/scripts/lib/transcript-parse.sh ~/Github/01-Repo/cyclone-dotfiles/cyclone/scripts/lib/
cp ~/.cyclone/scripts/tests/test-transcript-parse.sh ~/Github/01-Repo/cyclone-dotfiles/cyclone/scripts/tests/

cd ~/Github/01-Repo/cyclone-dotfiles
git add cyclone/scripts/lib/transcript-parse.sh cyclone/scripts/tests/test-transcript-parse.sh
git commit -m "feat(cyclone): add transcript-parse lib for jsonl extraction

Defensive jq handles both string and array forms of
message.content (tool_result arrays vs plain user text).
Pluggable format arg defaults to claude-code; other
harnesses (gemini-cli, etc.) can be added in the future.
Output is a flat U:/A:/[ToolName] line format suitable
for feeding to an LLM summarizer."
```

---

## Task 3: Create lib/ai-extract.sh (claude provider)

**Files:**
- Create: `~/.cyclone/scripts/lib/ai-extract.sh`
- Create: `~/.cyclone/scripts/tests/test-ai-extract.sh`

**Interface:**
- stdin: full prompt (schema instructions + transcript sample)
- stdout: YAML (no markdown fence)
- env: `CYCLONE_AI_PROVIDER` (default `claude`)
- Exit: 0 success, 2 unknown/missing provider, other = provider error

### Steps

- [ ] **Step 1: Write the failing test**

Create `~/.cyclone/scripts/tests/test-ai-extract.sh`:

```bash
#!/bin/bash
# Test lib/ai-extract.sh — claude provider + unknown-provider exit code.
# Claude test hits real API (cost ~¢1) and is gated behind $CYCLONE_RUN_AI_TESTS.
set -u

LIB="$HOME/.cyclone/scripts/lib/ai-extract.sh"
FAIL=0

# Case 1: unknown provider → exit 2
OUT=$(CYCLONE_AI_PROVIDER=nonexistent echo "ignored" | bash "$LIB" 2>&1)
EXIT=$?
if [ "$EXIT" -ne 2 ]; then
  echo "  FAIL: unknown provider, expected exit 2, got $EXIT"; FAIL=1
fi
if ! echo "$OUT" | grep -qi "unknown"; then
  echo "  FAIL: unknown provider should log 'unknown', got: $OUT"; FAIL=1
fi

# Case 2: claude provider — gated (API cost)
if [ -n "${CYCLONE_RUN_AI_TESTS:-}" ]; then
  OUT=$(echo "用繁體中文只回覆「OK-ai-extract」八個字。" | CYCLONE_AI_PROVIDER=claude bash "$LIB" 2>&1)
  EXIT=$?
  if [ "$EXIT" -ne 0 ]; then
    echo "  FAIL: claude provider exit $EXIT, output: $OUT"; FAIL=1
  fi
  if ! echo "$OUT" | grep -q "OK-ai-extract"; then
    echo "  FAIL: claude provider output missing expected marker"; echo "$OUT"; FAIL=1
  fi
else
  echo "  SKIP: claude API test (set CYCLONE_RUN_AI_TESTS=1 to run)"
fi

exit $FAIL
```

Make executable: `chmod +x ~/.cyclone/scripts/tests/test-ai-extract.sh`

- [ ] **Step 2: Run the test — expect FAIL**

```bash
bash ~/.cyclone/scripts/tests/test-ai-extract.sh
```

Expected: `FAIL: unknown provider, expected exit 2, got 127` (script missing) → exit 1.

- [ ] **Step 3: Create the lib script (claude provider only for now)**

Write `~/.cyclone/scripts/lib/ai-extract.sh`:

```bash
#!/bin/bash
# CycloneOS lib — AI provider abstraction for session log extraction
# stdin: prompt (schema + sample)
# stdout: YAML (no markdown fence)
# env: CYCLONE_AI_PROVIDER (claude|gemini|codex|openai-api|ollama; default: claude)
# Exit: 0 ok, 2 provider not implemented or CLI not found

set -u
PROVIDER="${CYCLONE_AI_PROVIDER:-claude}"

case "$PROVIDER" in
  claude)
    command -v claude >/dev/null 2>&1 || {
      echo "ai-extract: claude CLI not found" >&2; exit 2
    }
    exec timeout 50 claude -p --model haiku \
      --disable-slash-commands \
      --max-budget-usd 0.2 \
      --append-system-prompt "你是 session log 萃取器。嚴格只輸出 YAML，絕不加 markdown fence 或解釋文字。"
    ;;
  *)
    echo "ai-extract: unknown or not-yet-implemented provider '$PROVIDER'" >&2
    exit 2
    ;;
esac
```

Make executable: `chmod +x ~/.cyclone/scripts/lib/ai-extract.sh`

- [ ] **Step 4: Run the test — expect PASS (with SKIP)**

```bash
bash ~/.cyclone/scripts/tests/test-ai-extract.sh
echo "exit: $?"
```

Expected: only `SKIP: claude API test` line, exit 0.

- [ ] **Step 5: Run the claude API test once (costs ~¢1)**

```bash
CYCLONE_RUN_AI_TESTS=1 bash ~/.cyclone/scripts/tests/test-ai-extract.sh
echo "exit: $?"
```

Expected: no FAIL lines, exit 0 (takes ~10–15s).

If it fails with budget error: the `--max-budget-usd 0.2` in ai-extract.sh is too low for your account's minimum; bump to `0.5`.

- [ ] **Step 6: Mirror + commit**

```bash
cp ~/.cyclone/scripts/lib/ai-extract.sh ~/Github/01-Repo/cyclone-dotfiles/cyclone/scripts/lib/
cp ~/.cyclone/scripts/tests/test-ai-extract.sh ~/Github/01-Repo/cyclone-dotfiles/cyclone/scripts/tests/

cd ~/Github/01-Repo/cyclone-dotfiles
git add cyclone/scripts/lib/ai-extract.sh cyclone/scripts/tests/test-ai-extract.sh
git commit -m "feat(cyclone): add ai-extract lib with claude provider

Abstraction layer for LLM calls. v1 implements only the
claude provider (haiku model, --max-budget-usd 0.2 cost
cap, 50s timeout). Unknown providers exit 2 so callers
can fallback gracefully. API test gated behind
CYCLONE_RUN_AI_TESTS=1 to avoid accidental cost."
```

---

## Task 4: Add non-claude provider stubs to ai-extract.sh

**Why a separate task:** keeps Task 3 focused on the core path; this task validates the abstraction's shape by adding real (gemini, codex) and stub (openai-api, ollama) branches.

**Files:**
- Modify: `~/.cyclone/scripts/lib/ai-extract.sh`
- Modify: `~/.cyclone/scripts/tests/test-ai-extract.sh` (add cases)

### Steps

- [ ] **Step 1: Extend the test first**

Open `~/.cyclone/scripts/tests/test-ai-extract.sh` and append before `exit $FAIL`:

```bash
# Case 3: openai-api provider → not implemented → exit 2
OUT=$(CYCLONE_AI_PROVIDER=openai-api echo "x" | bash "$LIB" 2>&1)
EXIT=$?
if [ "$EXIT" -ne 2 ]; then
  echo "  FAIL: openai-api expected exit 2, got $EXIT"; FAIL=1
fi
if ! echo "$OUT" | grep -qi "not implemented"; then
  echo "  FAIL: openai-api should log 'not implemented', got: $OUT"; FAIL=1
fi

# Case 4: ollama provider → not implemented → exit 2
OUT=$(CYCLONE_AI_PROVIDER=ollama echo "x" | bash "$LIB" 2>&1)
EXIT=$?
if [ "$EXIT" -ne 2 ]; then
  echo "  FAIL: ollama expected exit 2, got $EXIT"; FAIL=1
fi

# Case 5: gemini with CLI missing → exit 2 with sensible msg
# (gemini IS installed in the user env; this test only runs if it is NOT installed,
#  otherwise we skip to avoid a real API call.)
if ! command -v gemini >/dev/null 2>&1; then
  OUT=$(CYCLONE_AI_PROVIDER=gemini echo "x" | bash "$LIB" 2>&1)
  EXIT=$?
  if [ "$EXIT" -ne 2 ]; then
    echo "  FAIL: gemini missing CLI expected exit 2, got $EXIT"; FAIL=1
  fi
else
  echo "  SKIP: gemini CLI installed; exec-path not tested here"
fi
```

- [ ] **Step 2: Run the test — expect FAIL on cases 3 & 4**

```bash
bash ~/.cyclone/scripts/tests/test-ai-extract.sh
```

Expected: FAIL lines for openai-api and ollama (current script says "unknown" not "not implemented"), exit 1.

- [ ] **Step 3: Extend ai-extract.sh with the new branches**

Replace the `case` block in `~/.cyclone/scripts/lib/ai-extract.sh` with:

```bash
case "$PROVIDER" in
  claude)
    command -v claude >/dev/null 2>&1 || {
      echo "ai-extract: claude CLI not found" >&2; exit 2
    }
    exec timeout 50 claude -p --model haiku \
      --disable-slash-commands \
      --max-budget-usd 0.2 \
      --append-system-prompt "你是 session log 萃取器。嚴格只輸出 YAML，絕不加 markdown fence 或解釋文字。"
    ;;
  gemini)
    command -v gemini >/dev/null 2>&1 || {
      echo "ai-extract: gemini CLI not found" >&2; exit 2
    }
    # Note: prompt quality not tuned for gemini in v1; may return sub-par YAML.
    exec timeout 50 gemini -p "$(cat)"
    ;;
  codex)
    command -v codex >/dev/null 2>&1 || {
      echo "ai-extract: codex CLI not found" >&2; exit 2
    }
    # Note: prompt quality not tuned for codex in v1; may return sub-par YAML.
    exec timeout 50 codex exec "$(cat)"
    ;;
  openai-api|ollama)
    echo "ai-extract: provider '$PROVIDER' not implemented in v1" >&2
    exit 2
    ;;
  *)
    echo "ai-extract: unknown provider '$PROVIDER'" >&2
    exit 2
    ;;
esac
```

- [ ] **Step 4: Run the test — expect PASS**

```bash
bash ~/.cyclone/scripts/tests/test-ai-extract.sh
echo "exit: $?"
```

Expected: exit 0 (with SKIP lines for API test and gemini exec path).

- [ ] **Step 5: Mirror + commit**

```bash
cp ~/.cyclone/scripts/lib/ai-extract.sh ~/Github/01-Repo/cyclone-dotfiles/cyclone/scripts/lib/
cp ~/.cyclone/scripts/tests/test-ai-extract.sh ~/Github/01-Repo/cyclone-dotfiles/cyclone/scripts/tests/

cd ~/Github/01-Repo/cyclone-dotfiles
git add cyclone/scripts/lib/ai-extract.sh cyclone/scripts/tests/test-ai-extract.sh
git commit -m "feat(cyclone): add gemini/codex/ollama/openai stubs to ai-extract

Gemini and codex get real exec paths (prompt quality
not tuned yet — v1 validates the abstraction works).
openai-api and ollama exit 2 with clear 'not implemented'
message so save-session.sh fallback can trigger
correctly. Unknown provider remains exit 2."
```

---

## Task 5: Rewrite save-session.sh — extraction pipeline + fallback

**Files:**
- Rewrite: `~/.cyclone/scripts/hooks/save-session.sh`
- Create: `~/.cyclone/scripts/tests/test-save-session.sh`

### Steps

- [ ] **Step 1: Write the failing test**

Create `~/.cyclone/scripts/tests/test-save-session.sh`:

```bash
#!/bin/bash
# Test save-session.sh — guard, fallback paths, filename convention, and
# (gated) full claude extraction end-to-end.
set -u

HOOK="$HOME/.cyclone/scripts/hooks/save-session.sh"
SESSION_DIR=$(jq -r '.hooks.session_log_dir' "$HOME/.cyclone/config.json")
FIXTURE="$HOME/.cyclone/scripts/tests/fixtures/sample-transcript.jsonl"
TODAY=$(date '+%Y-%m-%d')
FAIL=0

cleanup_today_auto_logs() {
  # Remove any -auto.md files from today to keep tests hermetic
  find "$SESSION_DIR" -name "$TODAY-session-*-auto.md" -delete 2>/dev/null
}

# Case 1: guard short-circuits
cleanup_today_auto_logs
OUT=$(CYCLONE_IN_HOOK=1 bash "$HOOK" <<< '{}' 2>&1)
EXIT=$?
if [ "$EXIT" -ne 0 ] || [ -n "$OUT" ]; then
  echo "  FAIL: guard case — exit $EXIT, output: $OUT"; FAIL=1
fi
PRODUCED=$(find "$SESSION_DIR" -name "$TODAY-session-*-auto.md" 2>/dev/null | wc -l | tr -d ' ')
if [ "$PRODUCED" -ne 0 ]; then
  echo "  FAIL: guard case produced $PRODUCED auto log file(s)"; FAIL=1
fi

# Case 2: no transcript_path in stdin → fallback with reason 'transcript-missing'
cleanup_today_auto_logs
bash "$HOOK" <<< '{}' >/dev/null 2>&1
sleep 1
LATEST=$(ls -t "$SESSION_DIR"/$TODAY-session-*-auto.md 2>/dev/null | head -1)
if [ -z "$LATEST" ]; then
  echo "  FAIL: no-transcript case did not produce a fallback log"; FAIL=1
else
  if ! grep -q "extraction: failed" "$LATEST"; then
    echo "  FAIL: no-transcript case missing 'extraction: failed'"; FAIL=1
  fi
  if ! grep -q "transcript-missing" "$LATEST"; then
    echo "  FAIL: no-transcript case missing reason 'transcript-missing'"; FAIL=1
  fi
fi

# Case 3: transcript_path points to nonexistent file → same fallback
cleanup_today_auto_logs
bash "$HOOK" <<< '{"transcript_path":"/tmp/does-not-exist.jsonl"}' >/dev/null 2>&1
sleep 1
LATEST=$(ls -t "$SESSION_DIR"/$TODAY-session-*-auto.md 2>/dev/null | head -1)
if [ -z "$LATEST" ] || ! grep -q "transcript-missing" "$LATEST"; then
  echo "  FAIL: nonexistent-transcript case did not fallback correctly"; FAIL=1
fi

# Case 4: provider stub triggers fallback with 'provider-not-ready'
cleanup_today_auto_logs
CYCLONE_AI_PROVIDER=ollama bash "$HOOK" <<< "{\"transcript_path\":\"$FIXTURE\"}" >/dev/null 2>&1
# Wait up to 15s for the background extraction to write a log
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  LATEST=$(ls -t "$SESSION_DIR"/$TODAY-session-*-auto.md 2>/dev/null | head -1)
  [ -n "$LATEST" ] && break
  sleep 1
done
if [ -z "$LATEST" ]; then
  echo "  FAIL: ollama-stub case never produced a log"; FAIL=1
elif ! grep -q "provider-not-ready" "$LATEST"; then
  echo "  FAIL: ollama-stub case missing reason 'provider-not-ready'"
  head -20 "$LATEST"
  FAIL=1
fi

# Case 5 (gated): full extraction with claude
cleanup_today_auto_logs
if [ -n "${CYCLONE_RUN_AI_TESTS:-}" ]; then
  bash "$HOOK" <<< "{\"transcript_path\":\"$FIXTURE\"}" >/dev/null 2>&1
  for i in $(seq 1 60); do
    LATEST=$(ls -t "$SESSION_DIR"/$TODAY-session-*-auto.md 2>/dev/null | head -1)
    if [ -n "$LATEST" ] && grep -q "extraction: success" "$LATEST" 2>/dev/null; then
      break
    fi
    sleep 1
  done
  if [ -z "$LATEST" ]; then
    echo "  FAIL: claude e2e — no log produced"; FAIL=1
  elif ! grep -q "extraction: success" "$LATEST"; then
    echo "  FAIL: claude e2e — extraction not success"
    head -30 "$LATEST"
    FAIL=1
  else
    for section in "## Summary" "## Decisions" "## Pending" "## Knowledge"; do
      if ! grep -qF "$section" "$LATEST"; then
        echo "  FAIL: claude e2e — missing section '$section'"; FAIL=1
      fi
    done
  fi
else
  echo "  SKIP: claude e2e test (set CYCLONE_RUN_AI_TESTS=1 to run)"
fi

cleanup_today_auto_logs
exit $FAIL
```

Make executable: `chmod +x ~/.cyclone/scripts/tests/test-save-session.sh`

- [ ] **Step 2: Run the test — expect FAIL**

```bash
bash ~/.cyclone/scripts/tests/test-save-session.sh
```

Expected: multiple FAIL lines (Case 2 will produce the existing stats-shell log with wrong filename suffix, Cases 3 and 4 similarly; guard case might pass because Task 1 already added guard). Exit 1.

- [ ] **Step 3: Rewrite save-session.sh**

Replace entire content of `~/.cyclone/scripts/hooks/save-session.sh` with:

```bash
#!/bin/bash
# CycloneOS SessionEnd Hook — extracts YAML session log via LLM helper,
# falls back to stats shell on any failure. Background-executed so the
# user can close the terminal immediately.

# Guard: prevent recursion from child claude -p processes
[ -n "${CYCLONE_IN_HOOK:-}" ] && exit 0

command -v jq >/dev/null 2>&1 || exit 0
[ -f "$HOME/.cyclone/config.json" ] || exit 0

STDIN=$(cat)
TRANSCRIPT_PATH=$(echo "$STDIN" | jq -r '.transcript_path // empty' 2>/dev/null)

CONFIG="$HOME/.cyclone/config.json"
SESSION_DIR=$(jq -r '.hooks.session_log_dir' "$CONFIG")
AUDIT="$HOME/.cyclone/logs/audit.jsonl"
LIB="$HOME/.cyclone/scripts/lib"
TODAY=$(date '+%Y-%m-%d')

mkdir -p "$SESSION_DIR" 2>/dev/null || exit 0

# Shared: compute next N (counts both manual and auto files to share counter)
compute_filename() {
  local count n
  count=$(ls "$SESSION_DIR" 2>/dev/null | grep "^$TODAY-session-" | wc -l | tr -d ' ')
  n=$((count + 1))
  echo "$SESSION_DIR/$TODAY-session-$n-auto.md|$n"
}

# Shared: stats snippet for both success and fallback
stats_block() {
  local ops last
  ops=0
  last="（無操作記錄）"
  if [ -f "$AUDIT" ] && [ -s "$AUDIT" ]; then
    ops=$(grep -c "$TODAY" "$AUDIT" 2>/dev/null || echo 0)
    last=$(tail -10 "$AUDIT" 2>/dev/null)
  fi
  echo "OPS=$ops"
  echo "LAST<<__LAST_EOF__"
  echo "$last"
  echo "__LAST_EOF__"
}

# Fallback writer (synchronous, used for instant failures)
write_fallback_sync() {
  local reason="$1"
  local end_time result n filename
  end_time=$(date '+%H:%M:%S')
  result=$(compute_filename)
  filename="${result%|*}"
  n="${result#*|}"

  local ops last
  ops=0
  last="（無操作記錄）"
  if [ -f "$AUDIT" ] && [ -s "$AUDIT" ]; then
    ops=$(grep -c "$TODAY" "$AUDIT" 2>/dev/null || echo 0)
    last=$(tail -10 "$AUDIT" 2>/dev/null)
  fi

  cat > "$filename" << EOF
---
type: session-log
date: $TODAY
session: $n
source: cycloneos
auto-generated: true
extraction: failed
reason: $reason
tags: [cyclone, session-log, auto]
---

# $TODAY Session $n（自動交接單 — 萃取失敗）

> ⚠️ 萃取失敗（reason: $reason），請手動檢視 transcript：${TRANSCRIPT_PATH:-unknown}

## 統計
- 今日操作數：$ops
- Session 結束時間：$end_time

## 最近 10 筆操作
\`\`\`
$last
\`\`\`
EOF
}

# No transcript path or file missing → fallback immediately (sync)
if [ -z "$TRANSCRIPT_PATH" ] || [ ! -f "$TRANSCRIPT_PATH" ]; then
  write_fallback_sync "transcript-missing"
  exit 0
fi

# Background extraction (nohup so caller can return fast)
nohup bash -c '
  export CYCLONE_IN_HOOK=1
  TRANSCRIPT_PATH='"$(printf %q "$TRANSCRIPT_PATH")"'
  SESSION_DIR='"$(printf %q "$SESSION_DIR")"'
  AUDIT='"$(printf %q "$AUDIT")"'
  LIB='"$(printf %q "$LIB")"'
  TODAY='"$(printf %q "$TODAY")"'

  sleep 0.5  # let Claude Code finish flushing transcript

  # --- Recompute filename at background start to minimize race with parallel sessions ---
  COUNT=$(ls "$SESSION_DIR" 2>/dev/null | grep "^$TODAY-session-" | wc -l | tr -d " ")
  N=$((COUNT + 1))
  FILENAME="$SESSION_DIR/$TODAY-session-$N-auto.md"

  # Stats
  OPS=0
  LAST="（無操作記錄）"
  if [ -f "$AUDIT" ] && [ -s "$AUDIT" ]; then
    OPS=$(grep -c "$TODAY" "$AUDIT" 2>/dev/null || echo 0)
    LAST=$(tail -10 "$AUDIT" 2>/dev/null)
  fi
  END_TIME=$(date "+%H:%M:%S")

  write_fallback() {
    REASON="$1"
    cat > "$FILENAME" << EOF
---
type: session-log
date: '"$TODAY"'
session: $N
source: cycloneos
auto-generated: true
extraction: failed
reason: $REASON
tags: [cyclone, session-log, auto]
---

# '"$TODAY"' Session $N（自動交接單 — 萃取失敗）

> ⚠️ 萃取失敗（reason: $REASON），請手動檢視 transcript：$TRANSCRIPT_PATH

## 統計
- 今日操作數：$OPS
- Session 結束時間：$END_TIME

## 最近 10 筆操作
\`\`\`
$LAST
\`\`\`
EOF
  }

  # Parse transcript
  SAMPLE=$("$LIB/transcript-parse.sh" "$TRANSCRIPT_PATH" claude-code 2>/dev/null)
  if [ -z "$SAMPLE" ]; then
    write_fallback "parse-error"
    exit 0
  fi

  # Build prompt
  PROMPT="以下是 Claude Code session 對話紀錄（U=使用者, A=assistant, [ToolName]=工具呼叫）。

請用繁體中文輸出 YAML，嚴格照以下 schema，不要 markdown fence：

summary: 一段話總結（40-80 字）
decisions:
  - 關鍵決策（無就空陣列 []）
pending:
  - 未完成項（無就空陣列 []）
knowledge:
  - 學到的新知識（無就空陣列 []）

--- 對話開始 ---
$SAMPLE
--- 對話結束 ---"

  START_MS=$(python3 -c "import time; print(int(time.time()*1000))" 2>/dev/null || date +%s000)
  YAML=$(echo "$PROMPT" | "$LIB/ai-extract.sh" 2>/dev/null)
  EXTRACT_EXIT=$?
  END_MS=$(python3 -c "import time; print(int(time.time()*1000))" 2>/dev/null || date +%s000)
  EXTRACT_MS=$((END_MS - START_MS))

  if [ $EXTRACT_EXIT -ne 0 ] || [ -z "$YAML" ]; then
    case $EXTRACT_EXIT in
      124) write_fallback "timeout" ;;
      2)   write_fallback "provider-not-ready" ;;
      *)   write_fallback "provider-error-$EXTRACT_EXIT" ;;
    esac
    exit 0
  fi

  if ! echo "$YAML" | grep -q "^summary:"; then
    write_fallback "yaml-invalid"
    exit 0
  fi

  PROVIDER="${CYCLONE_AI_PROVIDER:-claude}"

  SUMMARY=$(echo "$YAML" | awk "/^summary:/{sub(/^summary:[ ]*/,\"\"); print; exit}")
  DECISIONS=$(echo "$YAML" | awk "/^decisions:/{flag=1; next} /^[a-z]+:/{flag=0} flag && /^  - /{print}")
  PENDING=$(echo "$YAML" | awk "/^pending:/{flag=1; next} /^[a-z]+:/{flag=0} flag && /^  - /{print}")
  KNOWLEDGE=$(echo "$YAML" | awk "/^knowledge:/{flag=1; next} /^[a-z]+:/{flag=0} flag && /^  - /{print}")

  # Default empty-arr display
  [ -z "$DECISIONS" ] && DECISIONS="- （無）"
  [ -z "$PENDING" ] && PENDING="- （無）"
  [ -z "$KNOWLEDGE" ] && KNOWLEDGE="- （無）"

  cat > "$FILENAME" << EOF
---
type: session-log
date: '"$TODAY"'
session: $N
source: cycloneos
auto-generated: true
extraction: success
provider: $PROVIDER
extraction-ms: $EXTRACT_MS
tags: [cyclone, session-log, auto]
---

# '"$TODAY"' Session $N（自動交接單）

## Summary
$SUMMARY

## Decisions
$DECISIONS

## Pending
$PENDING

## Knowledge
$KNOWLEDGE

## 統計
- 今日操作數：$OPS
- Session 結束時間：$END_TIME
- 萃取耗時：${EXTRACT_MS}ms
- Provider：$PROVIDER
EOF
' > /dev/null 2>&1 &

disown 2>/dev/null || true
exit 0
```

Make executable: `chmod +x ~/.cyclone/scripts/hooks/save-session.sh`

- [ ] **Step 4: Run guard + fallback tests — expect PASS (Cases 1–4)**

```bash
bash ~/.cyclone/scripts/tests/test-save-session.sh
echo "exit: $?"
```

Expected: only `SKIP: claude e2e test` line, exit 0.

If Case 4 (`provider-not-ready`) fails because the background process hasn't written yet by second 15, increase the poll loop in the test to 20 seconds and rerun.

- [ ] **Step 5: Run full e2e test with claude (costs ~¢5)**

```bash
CYCLONE_RUN_AI_TESTS=1 bash ~/.cyclone/scripts/tests/test-save-session.sh
echo "exit: $?"
```

Expected: no FAIL lines, exit 0. Takes up to 60s (includes claude -p extraction).

- [ ] **Step 6: Manual inspection of a generated log**

```bash
# Trigger once more manually
bash ~/.cyclone/scripts/hooks/save-session.sh <<< "{\"transcript_path\":\"$HOME/.cyclone/scripts/tests/fixtures/sample-transcript.jsonl\"}"
sleep 25
ls -t ~/Library/CloudStorage/GoogleDrive-user@gmail.com/我的雲端硬碟/Obsidian-Cyclone/CycloneOS/sessions/*-auto.md | head -1 | xargs cat
```

Expected: frontmatter with `extraction: success`, then four sections with real content summarizing the fixture conversation.

After verification, delete the test-generated auto log so real sessions start fresh:
```bash
find ~/Library/CloudStorage/GoogleDrive-user@gmail.com/我的雲端硬碟/Obsidian-Cyclone/CycloneOS/sessions/ -name "$(date '+%Y-%m-%d')-session-*-auto.md" -delete
```

- [ ] **Step 7: Mirror + commit**

```bash
cp ~/.cyclone/scripts/hooks/save-session.sh ~/Github/01-Repo/cyclone-dotfiles/cyclone/scripts/hooks/
cp ~/.cyclone/scripts/tests/test-save-session.sh ~/Github/01-Repo/cyclone-dotfiles/cyclone/scripts/tests/

cd ~/Github/01-Repo/cyclone-dotfiles
git add cyclone/scripts/hooks/save-session.sh cyclone/scripts/tests/test-save-session.sh
git commit -m "feat(cyclone): rewrite save-session with YAML extraction + fallback

SessionEnd hook now:
- reads transcript_path from stdin (was ignored before)
- spawns a nohup background subprocess for extraction
- pipes transcript through lib/transcript-parse.sh → lib/ai-extract.sh
- writes -auto.md filename with 4 sections (Summary/Decisions/Pending/Knowledge)
- frontmatter carries extraction status, provider, elapsed ms
- falls back to stats shell on any failure path (transcript-missing,
  parse-error, timeout, provider-not-ready, yaml-invalid)

CYCLONE_IN_HOOK=1 is exported to the subprocess so the child
claude -p does not recurse into the same hook."
```

---

## Task 6: Upgrade session-start.sh Daily Brief

**Goal:** Replace the current bare filename listing of recent sessions with a parsed Summary + Pending block from the most recent log.

**Files:**
- Modify: `~/.cyclone/scripts/hooks/session-start.sh`
- Create: `~/.cyclone/scripts/tests/test-session-start.sh`

### Steps

- [ ] **Step 1: Write the failing test**

Create `~/.cyclone/scripts/tests/test-session-start.sh`:

```bash
#!/bin/bash
# Test session-start.sh — verify Daily Brief shows last session's summary/pending.
set -u

HOOK="$HOME/.cyclone/scripts/hooks/session-start.sh"
SESSION_DIR=$(jq -r '.hooks.session_log_dir' "$HOME/.cyclone/config.json")
TODAY=$(date '+%Y-%m-%d')
FAIL=0

# Prepare a synthetic recent log
FAKE_LOG="$SESSION_DIR/$TODAY-session-999-auto.md"
cat > "$FAKE_LOG" << 'EOF'
---
type: session-log
date: 2099-01-01
session: 999
source: cycloneos
auto-generated: true
extraction: success
provider: claude
tags: [cyclone, session-log, auto]
---

# 2099-01-01 Session 999（自動交接單）

## Summary
測試用摘要 TEST_SUMMARY_MARKER

## Decisions
- 測試決策 A
- 測試決策 B

## Pending
- 測試未完成 TEST_PENDING_MARKER
- 第二個未完成項目

## Knowledge
- 測試知識 A
EOF

OUT=$(bash "$HOOK" 2>&1)

if ! echo "$OUT" | grep -q "TEST_SUMMARY_MARKER"; then
  echo "  FAIL: brief did not include summary from latest log"; FAIL=1
fi
if ! echo "$OUT" | grep -q "TEST_PENDING_MARKER"; then
  echo "  FAIL: brief did not include pending from latest log"; FAIL=1
fi
if ! echo "$OUT" | grep -q "=== Ready ==="; then
  echo "  FAIL: brief did not complete (missing Ready marker)"; FAIL=1
fi

# Cleanup
rm -f "$FAKE_LOG"
exit $FAIL
```

Make executable: `chmod +x ~/.cyclone/scripts/tests/test-session-start.sh`

- [ ] **Step 2: Run the test — expect FAIL**

```bash
bash ~/.cyclone/scripts/tests/test-session-start.sh
```

Expected: FAIL on summary and pending markers (current script only shows filenames), exit 1.

- [ ] **Step 3: Locate the "最近 Session" block in session-start.sh**

Open `~/.cyclone/scripts/hooks/session-start.sh`. Find lines 58–67 (after Task 1's guard edit, line numbers shift by ~3; locate by content). The block is:

```bash
echo "最近 Session："
SESSION_DIR="$VAULT/CycloneOS/sessions"
if [ -d "$SESSION_DIR" ]; then
  ls -t "$SESSION_DIR" 2>/dev/null | head -3 | while read f; do
    echo "  - $f"
  done
else
  echo "  （尚無 session 記錄）"
fi
echo ""
```

- [ ] **Step 4: Replace that block with the upgraded version**

Replace the block with:

```bash
echo "最近 Session："
SESSION_DIR="$VAULT/CycloneOS/sessions"
if [ -d "$SESSION_DIR" ]; then
  # List latest 3 filenames (preserve existing behavior)
  ls -t "$SESSION_DIR" 2>/dev/null | head -3 | while read f; do
    echo "  - $f"
  done

  # Upgrade: parse the latest log's Summary + Pending sections
  LATEST=$(ls -t "$SESSION_DIR"/*.md 2>/dev/null | head -1)
  if [ -n "$LATEST" ]; then
    LATEST_NAME=$(basename "$LATEST")

    # Extract Summary (first non-empty line after "## Summary" until next "## ")
    SUMMARY=$(awk '
      /^## Summary/ {flag=1; next}
      /^## / {flag=0}
      flag && NF > 0 {print; exit}
    ' "$LATEST")

    # Extract Pending items (lines starting with "- " after "## Pending", stop at next "## ")
    PENDING=$(awk '
      /^## Pending/ {flag=1; next}
      /^## / {flag=0}
      flag && /^- / {print "    " $0}
    ' "$LATEST")

    if [ -n "$SUMMARY" ] || [ -n "$PENDING" ]; then
      echo ""
      echo "  上次 Session（$LATEST_NAME）："
      [ -n "$SUMMARY" ] && echo "    Summary：$SUMMARY"
      if [ -n "$PENDING" ]; then
        echo "    未完成："
        echo "$PENDING"
      fi
    fi
  fi
else
  echo "  （尚無 session 記錄）"
fi
echo ""
```

- [ ] **Step 5: Run the test — expect PASS**

```bash
bash ~/.cyclone/scripts/tests/test-session-start.sh
echo "exit: $?"
```

Expected: no FAIL lines, exit 0.

- [ ] **Step 6: Manual sanity — run the hook and check the output**

```bash
bash ~/.cyclone/scripts/hooks/session-start.sh
```

Expected: produces the existing Daily Brief, PLUS an `上次 Session` block below the filename list (only if there are session logs — if none, skips silently).

- [ ] **Step 7: Mirror + commit**

```bash
cp ~/.cyclone/scripts/hooks/session-start.sh ~/Github/01-Repo/cyclone-dotfiles/cyclone/scripts/hooks/
cp ~/.cyclone/scripts/tests/test-session-start.sh ~/Github/01-Repo/cyclone-dotfiles/cyclone/scripts/tests/

cd ~/Github/01-Repo/cyclone-dotfiles
git add cyclone/scripts/hooks/session-start.sh cyclone/scripts/tests/test-session-start.sh
git commit -m "feat(cyclone): upgrade daily brief with last session summary + pending

session-start.sh now parses the most recent session log
(manual or -auto) and shows its '## Summary' first line
and '## Pending' items inline in the Daily Brief. This
closes the loop with Task 5: the next session opens with
immediate context about where the previous one stopped,
without the user having to open a file."
```

---

## Task 7: End-to-end validation + CHANGELOG

**Purpose:** Real /clear-triggered SessionEnd test, provider-swap sanity, and project documentation.

**Files:**
- Modify: `~/CycloneOS/CHANGELOG.md` (add entry)
- Touch: `~/Github/01-Repo/cyclone-dotfiles/` (no file change, just commit CHANGELOG)

### Steps

- [ ] **Step 1: Run the full test suite**

```bash
CYCLONE_RUN_AI_TESTS=1 bash ~/.cyclone/scripts/tests/run-all.sh
echo "exit: $?"
```

Expected: all 5 test files PASS, exit 0. Takes ~60s for the claude e2e.

- [ ] **Step 2: Real session E2E**

Open a fresh Claude Code session in a scratch directory:

```bash
cd /tmp && claude
```

In that session, send one or two simple messages (e.g. "ls 目前目錄" and "謝謝"). Then trigger SessionEnd via `/clear`. Within 30 seconds:

```bash
ls -lt ~/Library/CloudStorage/GoogleDrive-user@gmail.com/我的雲端硬碟/Obsidian-Cyclone/CycloneOS/sessions/*-auto.md | head -1
```

Expected: a new `YYYY-MM-DD-session-N-auto.md` file exists. Open it and verify:
- `extraction: success` in frontmatter
- Four sections (Summary/Decisions/Pending/Knowledge) are non-empty or contain `- （無）`
- No duplicated files (guard is holding)

- [ ] **Step 3: Provider swap smoke**

Trigger save-session with an unimplemented provider to confirm fallback:

```bash
CYCLONE_AI_PROVIDER=ollama bash ~/.cyclone/scripts/hooks/save-session.sh \
  <<< "{\"transcript_path\":\"$HOME/.cyclone/scripts/tests/fixtures/sample-transcript.jsonl\"}"
sleep 15
ls -t ~/Library/CloudStorage/GoogleDrive-user@gmail.com/我的雲端硬碟/Obsidian-Cyclone/CycloneOS/sessions/*-auto.md | head -1 | xargs grep -E "extraction|reason|provider"
```

Expected: `extraction: failed`, `reason: provider-not-ready`, no `provider:` line (since success path not taken). Delete the test file afterward:
```bash
find ~/Library/CloudStorage/GoogleDrive-user@gmail.com/我的雲端硬碟/Obsidian-Cyclone/CycloneOS/sessions/ -name "$(date '+%Y-%m-%d')-session-*-auto.md" -delete
```

- [ ] **Step 4: Open a brand new Claude Code session to verify Daily Brief**

```bash
claude
```

In the new session, the opening Daily Brief should contain an `上次 Session` line with summary + pending from the last real session log.

- [ ] **Step 5: Update CHANGELOG**

Open `~/CycloneOS/CHANGELOG.md` and add at the top (under the header, whatever convention the file uses) a new entry:

```markdown
## 2026-04-18

### Added
- SessionEnd hook 自動萃取：對話結束時背景呼叫 `claude -p --model haiku` 讀 transcript，產出 YAML 格式交接單（Summary / Decisions / Pending / Knowledge 四欄）寫入 Obsidian `CycloneOS/sessions/YYYY-MM-DD-session-N-auto.md`。
- AI provider 抽象層：`~/.cyclone/scripts/lib/ai-extract.sh` 支援 claude / gemini / codex，openai-api / ollama 留 stub。透過 `CYCLONE_AI_PROVIDER` env 切換，**符合 CycloneOS 最高原則「AI Agent 無關性」**。
- Transcript 格式 adapter：`~/.cyclone/scripts/lib/transcript-parse.sh` 處理 Claude Code jsonl（defensive jq 支援 string/array 兩種 content）。
- SessionStart Daily Brief 升級：現在顯示上次 session log 的 Summary + Pending，新 session 開場立即接手。
- Hook 測試框架：`~/.cyclone/scripts/tests/` 純 bash 測試腳本，`run-all.sh` 一鍵跑全部。

### Fixed
- `CYCLONE_IN_HOOK` 遞迴 guard：5 個 hook 開頭皆檢查此 env var，避免子 `claude -p` 觸發父 hook 造成 session log 污染（2026-04-17 smoke test 重現此 bug）。
- `save-session.sh` 原本假設「SessionEnd 拿不到 transcript」——錯。Hook stdin 實際有 `transcript_path`，現在正確讀取。

### Reference
- Spec: `docs/superpowers/specs/2026-04-17-session-end-flush-design.md`
- Plan: `docs/superpowers/plans/2026-04-18-session-end-flush.md`
- 對照雷小蒙（Raymond 三十）架構：`session-end-flush.sh` 概念原型。CycloneOS 版加上 provider 抽象層。
```

- [ ] **Step 6: Commit CycloneOS CHANGELOG**

```bash
cd ~/CycloneOS
git add CHANGELOG.md
git commit -m "docs(changelog): record session-end-flush rollout

Adds the 2026-04-18 entry documenting:
- New SessionEnd hook extraction pipeline
- AI provider abstraction (ai-extract.sh, transcript-parse.sh)
- CYCLONE_IN_HOOK recursion guard fix
- SessionStart Daily Brief upgrade

See spec and plan in docs/superpowers/."
```

- [ ] **Step 7: Final sync check**

```bash
diff -rq ~/.cyclone/scripts/ ~/Github/01-Repo/cyclone-dotfiles/cyclone/scripts/ | head -10
```

Expected: empty output, or only trivial differences (e.g. `.DS_Store`). Any unexpected diff → `cp` the missing file from live to dotfiles and commit a cleanup.

- [ ] **Step 8: Final session-log manual — record this work**

Use `/session-log` to produce a manual (deep) session record for today documenting the rollout. This provides the first filename-N that will be overwritten by the next auto-N (shared counter).

---

## Post-plan notes

### Non-goals (deferred)

- `UserPromptSubmit → context-inject.sh` upgrade (inject last 3 days' summaries into every message) — deferred to separate task.
- `PreCompact → pre-compact-snapshot.sh` — currently saves git state, could be extended with LLM-based decision snapshot. Deferred.
- Full `openai-api` / `ollama` provider implementations in `ai-extract.sh`. v1 stubs are enough to prove abstraction.
- Tuning prompt for gemini / codex providers. v1 uses the same prompt body; output quality not measured.
- `/clear`-specific behavior (different extraction template for clear vs logout vs crash). Not needed in v1.

### Known v1 limits

- Background subprocess may race with a sibling SessionEnd that fires within ~1s (unlikely in practice). Mitigation: background computes `N` at start, so two parallel writes to the same filename is unlikely but theoretically possible. If observed, add `flock` in a future task.
- If the transcript hasn't flushed the last user/assistant turn by the `sleep 0.5` mark, that turn is missing from the sample. Rare and self-limiting.
- `awk`-based YAML parsing is simple and breaks if claude returns indented sub-sub-lists. The system prompt constrains the schema tightly, but edge case possible. If observed in practice, swap to `yq` (not currently installed).

### Cost estimate

- claude-haiku per extraction: ~$0.01–$0.05 depending on transcript size.
- User runs ~5–10 sessions per day: ~$0.10–$0.50/day = $3–$15/month.
- Hard cap: `--max-budget-usd 0.2` per call. If this is hit, fallback triggers automatically.
