# SPC Meeting Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add prep mode (備會模式) to the SPC meeting panel with multi-format output, reference file upload, session persistence, and PII masking.

**Architecture:** Dual-mode toggle on existing panel. Shared Step 1-3, divergent Step 4 output. Obsidian .md serves as both output and session persistence format. GitHub Pages push extracted into shared module.

**Tech Stack:** Next.js (App Router), React, TypeScript, Python (python-docx), GitHub CLI (gh), Obsidian Markdown

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/lib/github-pages.ts` | Shared GitHub Pages clone/commit/push logic |
| `src/lib/education/pii-mask.ts` | PII masking for names, addresses, phone numbers |
| `src/lib/education/spc-session.ts` | Parse/serialize .md ↔ panel state, detect drafts |
| `src/components/.../spc-meeting/ref-file-picker.tsx` | Reference file drag/browse per proposal or meeting-level |
| `src/components/.../spc-meeting/session-loader.tsx` | "Continue draft?" prompt + manual load UI |
| `src/app/api/education/spc-meeting/save-draft/route.ts` | Write panel state to Obsidian .md |
| `src/app/api/education/spc-meeting/load/route.ts` | Read .md and return parsed panel state |
| `scripts/education/html_template.py` | Style-C HTML template for GitHub Pages |

### Modified Files

| File | Change |
|------|--------|
| `src/components/.../spc-meeting/spc-meeting-panel.tsx` | Mode toggle, auto-save, session loading, prep-mode Step 4 |
| `src/components/.../spc-meeting/proposal-form.tsx` | Add ref-file-picker, hide decision in prep mode |
| `src/app/api/education/spc-meeting/generate/route.ts` | Support `mode: "prep"`, HTML output, PII masking |
| `src/app/api/presentations/push-github/route.ts` | Refactor to use shared `github-pages.ts` |
| `scripts/education/spc_meeting_core.py` | Add `action: "generate-agenda"`, PII masking in docx |

---

### Task 1: PII Masking Module (TypeScript)

**Files:**
- Create: `src/lib/education/pii-mask.ts`

- [ ] **Step 1: Create PII masking module**

```typescript
// src/lib/education/pii-mask.ts

/**
 * Mask a Chinese name by replacing middle characters with ○.
 * 2 chars: 王明 → 王○
 * 3 chars: 王小明 → 王○明
 * 4+ chars: 歐陽佩琪 → 歐○○琪
 */
export function maskName(name: string): string {
  if (name.length <= 1) return name;
  if (name.length === 2) return name[0] + "○";
  if (name.length === 3) return name[0] + "○" + name[2];
  // 4+ chars: keep first and last, mask middle
  return name[0] + "○".repeat(name.length - 2) + name[name.length - 1];
}

/** Regex patterns for PII detection */
const ADDRESS_PATTERN = /[\u4e00-\u9fff]{1,3}(縣|市)[\u4e00-\u9fff]{1,4}(鄉|鎮|市|區)[\u4e00-\u9fff\d\-號巷弄樓之]+/g;
const PHONE_PATTERN = /(?:0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{3,4}|\(?\d{2,3}\)?\s*\d{3,4}[-\s]?\d{3,4}|09\d{2}[-\s]?\d{3}[-\s]?\d{3})/g;

/**
 * Mask all PII in text: names (from known list), addresses, phone numbers.
 * @param text - The text to mask
 * @param names - Array of full names to mask
 */
export function maskPII(text: string, names: string[]): string {
  let result = text;

  // Mask names (longer names first to avoid partial matches)
  const sorted = [...names].sort((a, b) => b.length - a.length);
  for (const name of sorted) {
    if (!name || name.length < 2) continue;
    result = result.replaceAll(name, maskName(name));
  }

  // Remove addresses
  result = result.replace(ADDRESS_PATTERN, "（地址已隱藏）");

  // Remove phone numbers
  result = result.replace(PHONE_PATTERN, "（電話已隱藏）");

  return result;
}

/**
 * Collect all names that need masking from meeting data.
 * Includes student names and committee member names.
 */
export function collectNames(data: {
  chair?: string;
  recorder?: string;
  committee?: Array<{ name: string }>;
  proposals?: Array<{ students?: Array<{ name: string }> }>;
}): string[] {
  const names = new Set<string>();
  if (data.chair) names.add(data.chair);
  if (data.recorder) names.add(data.recorder);
  for (const m of data.committee ?? []) {
    if (m.name) names.add(m.name);
  }
  for (const p of data.proposals ?? []) {
    for (const s of p.students ?? []) {
      if (s.name) names.add(s.name);
    }
  }
  return [...names];
}
```

- [ ] **Step 2: Verify module compiles**

Run: `npx tsc --noEmit src/lib/education/pii-mask.ts 2>&1 | head -20`
Expected: No errors (or only unrelated existing errors)

- [ ] **Step 3: Commit**

```bash
git add src/lib/education/pii-mask.ts
git commit -m "feat(education): add PII masking module for name/address/phone"
```

---

### Task 2: PII Masking in Python

**Files:**
- Modify: `scripts/education/spc_meeting_core.py:534-542`

- [ ] **Step 1: Extend Python mask_name to handle 2-char names and add full PII masking**

Replace the existing `mask_name` function (lines 536-542) and add `mask_pii` below it:

```python
# ── 姓名遮蔽 ──

def mask_name(name: str) -> str:
    """遮蔽姓名中間字。"""
    if len(name) <= 1:
        return name
    if len(name) == 2:
        return name[0] + "○"
    if len(name) == 3:
        return name[0] + "○" + name[2]
    # 4+ chars: keep first and last
    return name[0] + "○" * (len(name) - 2) + name[-1]


import re

_ADDRESS_RE = re.compile(
    r"[\u4e00-\u9fff]{1,3}[縣市][\u4e00-\u9fff]{1,4}[鄉鎮市區][\u4e00-\u9fff\d\-號巷弄樓之]+"
)
_PHONE_RE = re.compile(
    r"(?:0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{3,4}|09\d{2}[-\s]?\d{3}[-\s]?\d{3})"
)


def mask_pii(text: str, names: list[str]) -> str:
    """Mask all PII in text: known names, addresses, phone numbers."""
    result = text
    # Longer names first
    for name in sorted(names, key=len, reverse=True):
        if name and len(name) >= 2:
            result = result.replace(name, mask_name(name))
    result = _ADDRESS_RE.sub("（地址已隱藏）", result)
    result = _PHONE_RE.sub("（電話已隱藏）", result)
    return result


def collect_names(record) -> list[str]:
    """Collect all names from a MeetingRecord for PII masking."""
    names = set()
    names.add(record.chair)
    names.add(record.recorder)
    for m in record.committee:
        if isinstance(m, dict):
            names.add(m.get("name", ""))
        elif hasattr(m, "name"):
            names.add(m.name)
    for p in record.proposals:
        for s in (p.students if p.students else []):
            if isinstance(s, dict):
                names.add(s.get("name", ""))
            elif isinstance(s, str):
                names.add(s)
    names.discard("")
    return list(names)
```

- [ ] **Step 2: Verify Python syntax**

Run: `python3 -c "import ast; ast.parse(open('scripts/education/spc_meeting_core.py').read()); print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add scripts/education/spc_meeting_core.py
git commit -m "feat(education): extend PII masking in Python — 2-char names, addresses, phones"
```

---

### Task 3: Shared GitHub Pages Module

**Files:**
- Create: `src/lib/github-pages.ts`

- [ ] **Step 1: Extract shared logic from push-github route**

```typescript
// src/lib/github-pages.ts
import { mkdir, writeFile } from "fs/promises";
import { execSync } from "child_process";
import { join } from "path";
import { homedir } from "os";

export interface GitHubPagesFile {
  name: string;
  content: string;
}

export interface PushOptions {
  repo: string;
  folder: string;
  files: GitHubPagesFile[];
  commitMessage: string;
  localDir?: string;
}

export interface PushResult {
  url: string;
  folder: string;
  repo: string;
}

/**
 * Push files to a GitHub Pages repo.
 * Handles clone/init, file writing, commit, and push.
 */
export async function pushToGitHubPages(options: PushOptions): Promise<PushResult> {
  const { repo, folder, files, commitMessage } = options;
  const repoName = repo.split("/").pop() ?? "repo";
  const localDir = options.localDir ?? join(homedir(), `${repoName}-repo`);
  const folderPath = join(localDir, folder);

  // Ensure repo exists and is up to date
  try {
    execSync(`git -C "${localDir}" rev-parse --git-dir`, { stdio: "pipe" });
    execSync(`git -C "${localDir}" pull --rebase 2>/dev/null || true`, { stdio: "pipe" });
  } catch {
    try {
      execSync(`gh repo clone ${repo} "${localDir}"`, { stdio: "pipe" });
    } catch {
      await mkdir(localDir, { recursive: true });
      execSync(`git -C "${localDir}" init`, { stdio: "pipe" });
      execSync(`gh repo create ${repo} --public --source="${localDir}" --push`, { stdio: "pipe" });
    }
  }

  // Write files
  await mkdir(folderPath, { recursive: true });
  for (const file of files) {
    await writeFile(join(folderPath, file.name), file.content, "utf-8");
  }

  // Git add, commit, push
  execSync(`git -C "${localDir}" add "${folder}"`, { stdio: "pipe" });
  execSync(`git -C "${localDir}" commit -m "${commitMessage.replace(/"/g, '\\"')}"`, { stdio: "pipe" });
  execSync(`git -C "${localDir}" push`, { stdio: "pipe" });

  const orgName = repo.split("/")[0];
  const repoBaseName = repo.split("/")[1];
  const url = `https://${orgName}.github.io/${repoBaseName}/${folder}/`;

  return { url, folder, repo };
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
```

- [ ] **Step 2: Verify module compiles**

Run: `npx tsc --noEmit src/lib/github-pages.ts 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/github-pages.ts
git commit -m "feat: extract shared GitHub Pages push module"
```

---

### Task 4: Refactor Presentations Push Route

**Files:**
- Modify: `src/app/api/presentations/push-github/route.ts`

- [ ] **Step 1: Refactor to use shared module**

Replace the entire file:

```typescript
// src/app/api/presentations/push-github/route.ts
import { pushToGitHubPages, slugify } from "@/lib/github-pages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SLIDES_REPO = "cyclone-tw/slides";

export async function POST(request: Request) {
  try {
    const { title, html, speakerNotes, folderName } = await request.json();

    if (!title || !html) {
      return Response.json({ error: "Missing title or html" }, { status: 400 });
    }

    const folder = folderName?.trim() || slugify(title);
    const files = [{ name: "index.html", content: html }];
    if (speakerNotes) {
      files.push({ name: "speaker-notes.md", content: speakerNotes });
    }

    const result = await pushToGitHubPages({
      repo: SLIDES_REPO,
      folder,
      files,
      commitMessage: `Add ${folder} slide`,
    });

    return Response.json({ success: true, ...result });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npx next build 2>&1 | tail -20` (or `npx tsc --noEmit`)
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/presentations/push-github/route.ts
git commit -m "refactor: presentations push route uses shared github-pages module"
```

---

### Task 5: SPC Session Persistence Module

**Files:**
- Create: `src/lib/education/spc-session.ts`

This module handles reading/writing .md files that represent meeting sessions, and converting between .md format and panel state.

- [ ] **Step 1: Create spc-session module**

```typescript
// src/lib/education/spc-session.ts
import { readdir, readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { OBSIDIAN_PATHS, spcMeetingFilename } from "./obsidian-paths";

export type MeetingStatus = "draft" | "agenda-generated" | "record-generated";
export type MeetingMode = "prep" | "record";

export interface SpcSessionMeta {
  type: string;
  academic_year: number;
  meeting_number: number;
  date: string;
  time_start: string;
  time_end?: string;
  location: string;
  chair: string;
  recorder: string;
  status: MeetingStatus;
  mode: MeetingMode;
  ref_files?: Array<{ path: string; scope: string }>;
  topics: string[];
  decisions: string[];
  tags: string[];
}

export interface SpcSessionData {
  meta: SpcSessionMeta;
  previousDecisions: string;
  businessReport: string;
  proposals: Array<{
    type: string;
    title: string;
    description: string;
    decision: string;
    students: Array<{ name: string; className: string; disability: string; detail: string }>;
    refDoc: string;
    refFiles?: Array<{ path: string; name: string }>;
  }>;
  motions: string;
}

/**
 * Build frontmatter YAML string from session meta.
 */
function buildFrontmatter(meta: SpcSessionMeta): string {
  const lines = [
    "---",
    `type: ${meta.type}`,
    `academic_year: ${meta.academic_year}`,
    `meeting_number: ${meta.meeting_number}`,
    `date: "${meta.date}"`,
    `time_start: "${meta.time_start}"`,
  ];
  if (meta.time_end) lines.push(`time_end: "${meta.time_end}"`);
  lines.push(
    `location: "${meta.location}"`,
    `chair: "${meta.chair}"`,
    `recorder: "${meta.recorder}"`,
    `status: "${meta.status}"`,
    `mode: "${meta.mode}"`,
  );

  if (meta.ref_files?.length) {
    lines.push("ref_files:");
    for (const rf of meta.ref_files) {
      lines.push(`  - path: "${rf.path}"`);
      lines.push(`    scope: "${rf.scope}"`);
    }
  }

  const topicsYaml = meta.topics.length
    ? meta.topics.map((t) => `  - ${t}`).join("\n")
    : "  - 未分類";
  lines.push("topics:", topicsYaml);

  if (meta.decisions.length) {
    lines.push("decisions:");
    for (const d of meta.decisions) {
      lines.push(`  - "${d.replace(/"/g, '\\"')}"`);
    }
  } else {
    lines.push("decisions:");
  }

  lines.push(`tags: [${meta.tags.join(", ")}]`);
  lines.push("---");
  return lines.join("\n");
}

/**
 * Build full Markdown body from session data.
 */
function buildBody(data: SpcSessionData): string {
  const lines: string[] = [];
  const { meta } = data;

  lines.push(
    `# ${meta.academic_year}學年度 第${meta.meeting_number}次特推會`,
    "",
    `- **日期**：${meta.date}`,
    `- **地點**：${meta.location}`,
    `- **主席**：${meta.chair}`,
    `- **記錄**：${meta.recorder}`,
    `- **狀態**：${meta.status}`,
    "",
    "---",
    "",
  );

  // Previous decisions
  if (data.previousDecisions) {
    lines.push("## 前次會議決議追蹤", "", data.previousDecisions, "");
  }

  // Business report
  lines.push("## 業務報告", "", data.businessReport || "（待填）", "");

  // Proposals
  if (data.proposals.length) {
    lines.push("## 提案討論", "");
    for (let i = 0; i < data.proposals.length; i++) {
      const p = data.proposals[i];
      lines.push(`### 案由${i + 1}：${p.title || p.type || "（待填）"}`, "");

      if (p.students.length) {
        lines.push("**涉及學生：**", "");
        lines.push("| 姓名 | 班級 | 障別程度 | 備註 |");
        lines.push("|------|------|---------|------|");
        for (const s of p.students) {
          lines.push(`| ${s.name} | ${s.className} | ${s.disability} | ${s.detail} |`);
        }
        lines.push("");
      }

      if (p.refDoc) lines.push(`**公文字號：** ${p.refDoc}`, "");

      if (p.refFiles?.length) {
        lines.push("**參考文件：**", "");
        for (const rf of p.refFiles) {
          lines.push(`- ${rf.name} (\`${rf.path}\`)`);
        }
        lines.push("");
      }

      lines.push("**說明：**", "", p.description || "（待填）", "");
      lines.push("**決議：**", "", p.decision || "（待會議決定）", "");
    }
  }

  // Motions
  lines.push("## 臨時動議", "", data.motions || "無", "");

  return lines.join("\n");
}

/**
 * Serialize session data to a complete .md string.
 */
export function serializeSession(data: SpcSessionData): string {
  const frontmatter = buildFrontmatter(data.meta);
  const body = buildBody(data);
  return `${frontmatter}\n\n${body}`;
}

/**
 * Parse a .md file content back into session data.
 */
export function parseSession(content: string): SpcSessionData | null {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return null;

  const yaml = fmMatch[1];
  const meta = parseYamlMeta(yaml);
  const body = content.slice(fmMatch[0].length).trim();

  const previousDecisions = extractSection(body, "前次會議決議追蹤");
  const businessReport = extractSection(body, "業務報告");
  const motions = extractSection(body, "臨時動議");
  const proposals = extractProposals(body);

  return {
    meta,
    previousDecisions,
    businessReport,
    proposals,
    motions,
  };
}

function parseYamlMeta(yaml: string): SpcSessionMeta {
  const result: Record<string, unknown> = {};
  const lines = yaml.split("\n");
  let currentKey = "";
  let listItems: Array<unknown> = [];
  let inRefFiles = false;
  let currentRefFile: Record<string, string> = {};

  for (const line of lines) {
    if (line.startsWith("  - ") && inRefFiles) {
      // ref_files list item
      if (line.includes("path:")) {
        if (currentRefFile.path) listItems.push({ ...currentRefFile });
        currentRefFile = { path: line.replace(/.*path:\s*"?/, "").replace(/"?\s*$/, "") };
      } else if (line.includes("scope:")) {
        currentRefFile.scope = line.replace(/.*scope:\s*"?/, "").replace(/"?\s*$/, "");
      } else {
        const val = line.slice(4).replace(/^["']|["']$/g, "").trim();
        listItems.push(val);
      }
      continue;
    }

    if (line.startsWith("  - ")) {
      const val = line.slice(4).replace(/^["']|["']$/g, "").trim();
      listItems.push(val);
      continue;
    }

    // Save previous list
    if (currentKey && listItems.length) {
      if (inRefFiles && currentRefFile.path) listItems.push({ ...currentRefFile });
      result[currentKey] = listItems;
      listItems = [];
      inRefFiles = false;
      currentRefFile = {};
    }

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const rawValue = line.slice(colonIdx + 1).trim();

    if (rawValue === "" || rawValue === undefined) {
      currentKey = key;
      listItems = [];
      inRefFiles = key === "ref_files";
      continue;
    }

    // Inline array
    if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
      result[key] = rawValue
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""));
      continue;
    }

    const cleaned = rawValue.replace(/^["']|["']$/g, "");
    const num = Number(cleaned);
    result[key] = isNaN(num) || cleaned === "" ? cleaned : num;
  }

  // Flush last list
  if (currentKey && listItems.length) {
    if (inRefFiles && currentRefFile.path) listItems.push({ ...currentRefFile });
    result[currentKey] = listItems;
  }

  return {
    type: (result.type as string) ?? "特推會會議",
    academic_year: (result.academic_year as number) ?? 114,
    meeting_number: (result.meeting_number as number) ?? 1,
    date: (result.date as string) ?? "",
    time_start: (result.time_start as string) ?? "",
    time_end: (result.time_end as string) ?? undefined,
    location: (result.location as string) ?? "",
    chair: (result.chair as string) ?? "",
    recorder: (result.recorder as string) ?? "",
    status: ((result.status as string) ?? "draft") as MeetingStatus,
    mode: ((result.mode as string) ?? "prep") as MeetingMode,
    ref_files: (result.ref_files as Array<{ path: string; scope: string }>) ?? [],
    topics: (result.topics as string[]) ?? [],
    decisions: (result.decisions as string[]) ?? [],
    tags: (result.tags as string[]) ?? ["特推會"],
  };
}

function extractSection(body: string, heading: string): string {
  const pattern = new RegExp(`## ${heading}\\n\\n([\\s\\S]*?)(?=\\n## |$)`);
  const match = body.match(pattern);
  if (!match) return "";
  return match[1].trim().replace(/^（待填）$/, "");
}

function extractProposals(body: string): SpcSessionData["proposals"] {
  const proposalSection = body.match(/## 提案討論\n\n([\s\S]*?)(?=\n## [^#]|$)/);
  if (!proposalSection) return [];

  const text = proposalSection[1];
  const blocks = text.split(/### 案由\d+：/).slice(1);
  const proposals: SpcSessionData["proposals"] = [];

  for (const block of blocks) {
    const titleLine = block.split("\n")[0].trim();
    const type = titleLine.replace(/（待填）/, "").trim();

    // Extract students table
    const students: Array<{ name: string; className: string; disability: string; detail: string }> = [];
    const tableMatch = block.match(/\| 姓名.*\n\|[-\s|]+\n((?:\|.*\n)*)/);
    if (tableMatch) {
      for (const row of tableMatch[1].trim().split("\n")) {
        const cells = row.split("|").map((c) => c.trim()).filter(Boolean);
        if (cells.length >= 3) {
          students.push({
            name: cells[0],
            className: cells[1],
            disability: cells[2],
            detail: cells[3] ?? "",
          });
        }
      }
    }

    const refDoc = block.match(/\*\*公文字號：\*\*\s*(.*)/)?.[1]?.trim() ?? "";

    // Extract ref files
    const refFilesMatch = block.match(/\*\*參考文件：\*\*\n\n((?:- .*\n)*)/);
    const refFiles: Array<{ path: string; name: string }> = [];
    if (refFilesMatch) {
      for (const line of refFilesMatch[1].trim().split("\n")) {
        const m = line.match(/- (.+?) \(`(.+?)`\)/);
        if (m) refFiles.push({ name: m[1], path: m[2] });
      }
    }

    const description = extractSection(block, "說明") ||
      block.match(/\*\*說明：\*\*\n\n([\s\S]*?)(?=\n\*\*決議|$)/)?.[1]?.trim().replace(/^（待填）$/, "") || "";
    const decision = block.match(/\*\*決議：\*\*\n\n([\s\S]*?)(?=\n### |$)/)?.[1]?.trim().replace(/^（待會議決定）$/, "") || "";

    proposals.push({
      type,
      title: titleLine,
      description,
      decision,
      students,
      refDoc,
      refFiles: refFiles.length ? refFiles : undefined,
    });
  }

  return proposals;
}

/**
 * Save session data to Obsidian .md file.
 * Returns the file path.
 */
export async function saveSessionToFile(data: SpcSessionData): Promise<string> {
  const { meta } = data;
  const topics = data.proposals.map((p) => p.type || p.title).filter(Boolean);
  const topicStr = topics.join("&") || "草稿";

  const filename = spcMeetingFilename(meta.academic_year, meta.meeting_number, topicStr);
  const filepath = join(OBSIDIAN_PATHS.spcMeeting, filename);

  await mkdir(OBSIDIAN_PATHS.spcMeeting, { recursive: true });

  // Update meta topics/decisions from proposals
  data.meta.topics = topics;
  data.meta.decisions = data.proposals.map((p) => p.decision).filter(Boolean);

  const content = serializeSession(data);
  await writeFile(filepath, content, "utf-8");
  return filepath;
}

/**
 * Find meeting files that are not yet record-generated (i.e., still in progress).
 */
export async function findDraftSessions(academicYear?: number): Promise<Array<{
  filename: string;
  status: MeetingStatus;
  meetingNumber: number;
  date: string;
  topics: string[];
}>> {
  const dir = OBSIDIAN_PATHS.spcMeeting;
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }

  const drafts: Array<{
    filename: string;
    status: MeetingStatus;
    meetingNumber: number;
    date: string;
    topics: string[];
  }> = [];

  for (const file of files.filter((f) => f.endsWith(".md") && !f.startsWith("moc-")).sort().reverse()) {
    const content = await readFile(join(dir, file), "utf-8");
    const session = parseSession(content);
    if (!session) continue;
    if (academicYear && session.meta.academic_year !== academicYear) continue;
    if (session.meta.status === "record-generated") continue;

    drafts.push({
      filename: file,
      status: session.meta.status,
      meetingNumber: session.meta.meeting_number,
      date: session.meta.date,
      topics: session.meta.topics,
    });
  }

  return drafts;
}

/**
 * Load a session from an Obsidian .md file.
 */
export async function loadSessionFromFile(filename: string): Promise<SpcSessionData | null> {
  const filepath = join(OBSIDIAN_PATHS.spcMeeting, filename);
  try {
    const content = await readFile(filepath, "utf-8");
    return parseSession(content);
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Verify module compiles**

Run: `npx tsc --noEmit src/lib/education/spc-session.ts 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/education/spc-session.ts
git commit -m "feat(education): SPC session persistence — .md ↔ panel state serialization"
```

---

### Task 6: Save Draft API Route

**Files:**
- Create: `src/app/api/education/spc-meeting/save-draft/route.ts`

- [ ] **Step 1: Create save-draft API**

```typescript
// src/app/api/education/spc-meeting/save-draft/route.ts
import { saveSessionToFile, type SpcSessionData } from "@/lib/education/spc-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const data: SpcSessionData = {
      meta: {
        type: "特推會會議",
        academic_year: body.academicYear ?? 114,
        meeting_number: body.meetingNumber ?? 1,
        date: body.date ?? "",
        time_start: body.timeStart ?? "",
        time_end: body.timeEnd ?? undefined,
        location: body.location ?? "",
        chair: body.chair ?? "",
        recorder: body.recorder ?? "",
        status: body.status ?? "draft",
        mode: body.mode ?? "prep",
        ref_files: body.refFiles ?? [],
        topics: (body.proposals ?? []).map((p: { type?: string }) => p.type).filter(Boolean),
        decisions: (body.proposals ?? []).map((p: { decision?: string }) => p.decision).filter(Boolean),
        tags: ["特推會"],
      },
      previousDecisions: body.previousDecisions ?? "",
      businessReport: body.businessReport ?? "",
      proposals: (body.proposals ?? []).map((p: Record<string, unknown>) => ({
        type: (p.type as string) ?? "",
        title: (p.title as string) ?? "",
        description: (p.description as string) ?? "",
        decision: (p.decision as string) ?? "",
        students: (p.students as Array<{ name: string; className: string; disability: string; detail: string }>) ?? [],
        refDoc: (p.refDoc as string) ?? "",
        refFiles: (p.refFiles as Array<{ path: string; name: string }>) ?? undefined,
      })),
      motions: body.motions ?? "無",
    };

    const filepath = await saveSessionToFile(data);

    return Response.json({ saved: true, path: filepath });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/education/spc-meeting/save-draft/route.ts
git commit -m "feat(education): save-draft API route for SPC meeting session persistence"
```

---

### Task 7: Load Session API Route

**Files:**
- Create: `src/app/api/education/spc-meeting/load/route.ts`

- [ ] **Step 1: Create load API with GET (list drafts) and POST (load specific file)**

```typescript
// src/app/api/education/spc-meeting/load/route.ts
import { findDraftSessions, loadSessionFromFile } from "@/lib/education/spc-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET: List draft/in-progress sessions */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year") ? parseInt(searchParams.get("year")!, 10) : undefined;

    const drafts = await findDraftSessions(year);
    return Response.json({ drafts });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

/** POST: Load a specific session file */
export async function POST(request: Request) {
  try {
    const { filename } = await request.json();
    if (!filename) {
      return Response.json({ error: "Missing filename" }, { status: 400 });
    }

    const session = await loadSessionFromFile(filename);
    if (!session) {
      return Response.json({ error: "File not found or parse failed" }, { status: 404 });
    }

    return Response.json({ session });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/education/spc-meeting/load/route.ts
git commit -m "feat(education): load session API — list drafts + load specific meeting"
```

---

### Task 8: Reference File Picker Component

**Files:**
- Create: `src/components/skills/workstations/education/spc-meeting/ref-file-picker.tsx`

- [ ] **Step 1: Create wrapper around SharedSourceList for reference files**

```tsx
// src/components/skills/workstations/education/spc-meeting/ref-file-picker.tsx
"use client";

import { SharedSourceList } from "../../shared/source-list";
import type { SourceItem } from "@/stores/documents-store";

export interface RefFile {
  id: string;
  path: string;
  name: string;
  isDirectory: boolean;
}

interface RefFilePickerProps {
  label: string;
  files: RefFile[];
  onChange: (files: RefFile[]) => void;
}

export function RefFilePicker({ label, files, onChange }: RefFilePickerProps) {
  const sources: SourceItem[] = files.map((f) => ({
    id: f.id,
    type: "local" as const,
    path: f.path,
    name: f.name,
    isDirectory: f.isDirectory,
  }));

  const handleAdd = (newSources: SourceItem[]) => {
    const newFiles: RefFile[] = newSources.map((s) => ({
      id: s.id,
      path: s.path,
      name: s.name,
      isDirectory: s.isDirectory,
    }));
    onChange([...files, ...newFiles]);
  };

  const handleRemove = (id: string) => {
    onChange(files.filter((f) => f.id !== id));
  };

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-cy-muted">{label}</label>
      <SharedSourceList
        sources={sources}
        onAddSources={handleAdd}
        onRemoveSource={handleRemove}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/skills/workstations/education/spc-meeting/ref-file-picker.tsx
git commit -m "feat(education): RefFilePicker — reference file drag/browse for proposals"
```

---

### Task 9: Session Loader Component

**Files:**
- Create: `src/components/skills/workstations/education/spc-meeting/session-loader.tsx`

- [ ] **Step 1: Create session loader UI**

```tsx
// src/components/skills/workstations/education/spc-meeting/session-loader.tsx
"use client";

import { useEffect, useState } from "react";
import { FileText, FolderOpen, Plus } from "lucide-react";

interface DraftSession {
  filename: string;
  status: string;
  meetingNumber: number;
  date: string;
  topics: string[];
}

interface SessionLoaderProps {
  academicYear: number;
  onLoad: (filename: string) => void;
  onNew: () => void;
}

export function SessionLoader({ academicYear, onLoad, onNew }: SessionLoaderProps) {
  const [drafts, setDrafts] = useState<DraftSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/education/spc-meeting/load?year=${academicYear}`);
        const data = await res.json();
        setDrafts(data.drafts ?? []);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [academicYear]);

  if (loading) return null;
  if (drafts.length === 0) return null;

  const statusLabel = (status: string) => {
    switch (status) {
      case "draft": return "草稿";
      case "agenda-generated": return "已備會";
      default: return status;
    }
  };

  return (
    <div className="rounded-lg border border-cy-accent/30 bg-cy-accent/5 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-cy-text">
        <FolderOpen className="h-4 w-4 text-cy-accent" />
        偵測到未完成的會議
      </div>

      <div className="space-y-1.5">
        {(showAll ? drafts : drafts.slice(0, 3)).map((d) => (
          <button
            key={d.filename}
            onClick={() => onLoad(d.filename)}
            className="flex w-full items-center gap-2 rounded-md bg-cy-input/50 px-3 py-2 text-left text-sm hover:bg-cy-input transition-colors"
          >
            <FileText className="h-3.5 w-3.5 shrink-0 text-cy-muted" />
            <span className="flex-1 text-cy-text">
              第 {d.meetingNumber} 次 — {d.topics.join("、") || "未分類"}
            </span>
            <span className="shrink-0 text-xs text-cy-muted">{statusLabel(d.status)}</span>
            {d.date && <span className="shrink-0 text-xs text-cy-muted">{d.date}</span>}
          </button>
        ))}
        {!showAll && drafts.length > 3 && (
          <button
            onClick={() => setShowAll(true)}
            className="text-xs text-cy-accent hover:text-cy-accent/80"
          >
            顯示更多 ({drafts.length - 3})
          </button>
        )}
      </div>

      <button
        onClick={onNew}
        className="flex items-center gap-1.5 text-xs text-cy-muted hover:text-cy-text"
      >
        <Plus className="h-3 w-3" />
        開新會議
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/skills/workstations/education/spc-meeting/session-loader.tsx
git commit -m "feat(education): SessionLoader — detect and resume draft meetings"
```

---

### Task 10: Update SPC Meeting Panel — Mode Toggle + Session Integration

**Files:**
- Modify: `src/components/skills/workstations/education/spc-meeting/spc-meeting-panel.tsx`

This is the largest change. We add: mode toggle, auto-save on step change, session loading, prep-mode Step 4.

- [ ] **Step 1: Add imports and mode state**

At the top of the file, add new imports after the existing ones (after line 13):

```typescript
import { RefFilePicker, type RefFile } from "./ref-file-picker";
import { SessionLoader } from "./session-loader";
```

Add mode state and session state inside the component, after line 34 (`type Step = 1 | 2 | 3 | 4;`), in the component body after `const [step, setStep] = useState<Step>(1);` (line 37):

```typescript
  // Mode: prep (備會) or record (記錄)
  const [mode, setMode] = useState<"prep" | "record">("prep");
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  // Meeting-level reference files
  const [meetingRefFiles, setMeetingRefFiles] = useState<RefFile[]>([]);
```

- [ ] **Step 2: Add auto-save function and step-change wrapper**

Add these functions after the `updateHeader` function (after line 143):

```typescript
  // Auto-save draft to Obsidian .md
  const saveDraft = async () => {
    setSaving(true);
    try {
      const allRefFiles = [
        ...meetingRefFiles.map((f) => ({ path: f.path, scope: "meeting" })),
        ...proposals.flatMap((p, i) =>
          (p.refFiles ?? []).map((f: RefFile) => ({ path: f.path, scope: `proposal-${i}` }))
        ),
      ];

      await fetch("/api/education/spc-meeting/save-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academicYear: parseInt(headerValues.academicYear, 10),
          meetingNumber: parseInt(headerValues.meetingNumber, 10),
          date: headerValues.meetingDate,
          timeStart: headerValues.timeStart,
          timeEnd: finalSections.timeEnd,
          location: headerValues.location,
          chair: headerValues.chair,
          recorder: headerValues.recorder,
          status: "draft",
          mode,
          refFiles: allRefFiles,
          previousDecisions,
          businessReport,
          proposals: proposals.map((p) => ({
            type: p.type,
            title: p.title,
            description: p.description,
            decision: p.decision,
            students: p.students,
            refDoc: p.refDoc,
            refFiles: p.refFiles,
          })),
          motions: finalSections.motions,
        }),
      });
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  // Step change with auto-save
  const changeStep = (newStep: Step) => {
    setStep(newStep);
    if (sessionLoaded || headerValues.meetingNumber) {
      saveDraft();
    }
  };

  // Load session from .md file
  const loadSession = async (filename: string) => {
    try {
      const res = await fetch("/api/education/spc-meeting/load", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename }),
      });
      const { session } = await res.json();
      if (!session) return;

      const { meta } = session;
      setHeaderValues({
        academicYear: String(meta.academic_year),
        meetingNumber: String(meta.meeting_number),
        meetingDate: meta.date,
        timeStart: meta.time_start,
        location: meta.location,
        chair: meta.chair,
        recorder: meta.recorder,
      });
      setMode(meta.mode ?? "prep");
      setPreviousDecisions(session.previousDecisions);
      setBusinessReport(session.businessReport);
      setProposals(
        session.proposals.length
          ? session.proposals.map((p: Record<string, unknown>) => ({
              type: (p.type as string) ?? "",
              title: (p.title as string) ?? "",
              description: (p.description as string) ?? "",
              decision: (p.decision as string) ?? "",
              students: (p.students as StudentInfo[]) ?? [],
              refDoc: (p.refDoc as string) ?? "",
              refFiles: (p.refFiles as RefFile[]) ?? [],
            }))
          : [{ ...EMPTY_PROPOSAL }]
      );
      setFinalSections({
        motions: session.motions || "無",
        timeEnd: meta.time_end || "",
      });

      // Restore ref files
      const meetingRefs = (meta.ref_files ?? [])
        .filter((rf: { scope: string }) => rf.scope === "meeting")
        .map((rf: { path: string }) => ({
          id: crypto.randomUUID(),
          path: rf.path,
          name: rf.path.split("/").pop() ?? rf.path,
          isDirectory: false,
        }));
      setMeetingRefFiles(meetingRefs);

      setSessionLoaded(true);
    } catch {
      // ignore
    }
  };
```

Note: You'll also need to add `StudentInfo` to the import from `student-picker` or define it locally. The existing `ProposalData` interface needs a `refFiles` field — this is handled in Task 11.

- [ ] **Step 3: Add mode toggle to the header area**

Replace the header section (lines 218-228) with:

```tsx
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-cy-border pb-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-cy-muted hover:bg-cy-input/50 hover:text-cy-text transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          教育工作站
        </button>
        <span className="text-lg">📋</span>
        <h1 className="text-lg font-bold text-cy-text">特推會會議</h1>
        <div className="ml-auto flex rounded-full bg-cy-input/50 p-0.5">
          <button
            onClick={() => setMode("prep")}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${
              mode === "prep"
                ? "bg-cy-accent text-white"
                : "text-cy-muted hover:text-cy-text"
            }`}
          >
            備會模式
          </button>
          <button
            onClick={() => setMode("record")}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${
              mode === "record"
                ? "bg-cy-accent text-white"
                : "text-cy-muted hover:text-cy-text"
            }`}
          >
            記錄模式
          </button>
        </div>
        {saving && <span className="text-xs text-cy-muted">暫存中...</span>}
      </div>
```

- [ ] **Step 4: Add session loader before Step 1 content**

Inside `{step === 1 && ( ... )}`, before `<MeetingHeaderForm>`, add:

```tsx
              {!sessionLoaded && (
                <SessionLoader
                  academicYear={parseInt(headerValues.academicYear, 10) || 114}
                  onLoad={loadSession}
                  onNew={() => setSessionLoaded(true)}
                />
              )}
```

- [ ] **Step 5: Replace all `setStep(N)` calls with `changeStep(N)`**

Replace every `onClick={() => setStep(N as Step)}` with `onClick={() => changeStep(N as Step)}` throughout the JSX. This includes:
- Step indicator buttons (line 235)
- Next/Previous buttons in each step

- [ ] **Step 6: Add meeting-level ref files in Step 2**

In the Step 2 section, after `<BusinessReportEditor>` (around line 299), add:

```tsx
              <RefFilePicker
                label="會議層級參考文件（學期行事曆、通用公文等）"
                files={meetingRefFiles}
                onChange={setMeetingRefFiles}
              />
```

- [ ] **Step 7: Update Step 4 for dual-mode output**

Replace the Step 4 content with:

```tsx
          {step === 4 && (
            <>
              {mode === "record" && (
                <MeetingSectionEditor
                  sections={finalSectionDefs}
                  values={finalSections}
                  onChange={(key, val) => setFinalSections((v) => ({ ...v, [key]: val }))}
                />
              )}
              <DownloadPanel
                result={downloadResult}
                loading={generating}
                onGenerate={mode === "prep" ? handleGenerateAgenda : handleGenerate}
                generateLabel={mode === "prep" ? "產出會前附件" : "生成會議記錄"}
              />
              {mode === "prep" && (
                <label className="flex items-center gap-2 text-xs text-cy-muted">
                  <input
                    type="checkbox"
                    checked={pushToGitHub}
                    onChange={(e) => setPushToGitHub(e.target.checked)}
                    className="rounded"
                  />
                  同時發布到 GitHub Pages
                </label>
              )}
              <button
                onClick={() => changeStep(3)}
                className="rounded-md border border-cy-border px-4 py-2 text-sm text-cy-muted hover:text-cy-text transition-colors"
              >
                上一步
              </button>
            </>
          )}
```

- [ ] **Step 8: Add pushToGitHub state and handleGenerateAgenda**

Add state after the existing `downloadResult` state:

```typescript
  const [pushToGitHub, setPushToGitHub] = useState(false);
```

Add the prep-mode generate function after `handleGenerate`:

```typescript
  const handleGenerateAgenda = async () => {
    setGenerating(true);
    try {
      const body = {
        action: "generate-agenda",
        academicYear: parseInt(headerValues.academicYear, 10),
        meetingNumber: parseInt(headerValues.meetingNumber, 10),
        date: headerValues.meetingDate,
        timeStart: headerValues.timeStart,
        location: headerValues.location,
        chair: headerValues.chair,
        recorder: headerValues.recorder,
        businessReport,
        previousTracking: previousDecisions,
        proposals: proposals.map((p) => ({
          type: p.type,
          title: p.title,
          description: p.description,
          students: p.students,
          refDoc: p.refDoc,
        })),
        committee: committee.map((m) => ({ title: m.title, name: m.name, role: m.role })),
        pushToGitHub,
      };

      const res = await fetch("/api/education/spc-meeting/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.headers.get("Content-Type")?.includes("application/vnd.openxmlformats")) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const disposition = res.headers.get("Content-Disposition") ?? "";
        const filenameMatch = disposition.match(/filename\*=UTF-8''(.+)/);
        const filename = filenameMatch ? decodeURIComponent(filenameMatch[1]) : "agenda.docx";

        setDownloadResult({
          docxUrl: url,
          docxFilename: filename,
          mdPath: res.headers.get("X-Md-Path") ?? undefined,
          mocUpdated: res.headers.get("X-Moc-Updated") === "true",
          htmlUrl: res.headers.get("X-Html-Url") ?? undefined,
        });
      }
    } catch (err) {
      console.error("Generate agenda failed:", err);
    } finally {
      setGenerating(false);
    }
  };
```

Also update the `downloadResult` type to include `htmlUrl`:

```typescript
  const [downloadResult, setDownloadResult] = useState<{
    docxUrl?: string;
    docxFilename?: string;
    mdPath?: string;
    mocUpdated?: boolean;
    htmlUrl?: string;
  } | null>(null);
```

- [ ] **Step 9: Update STEPS label based on mode**

Change the STEPS constant to a function of mode:

```typescript
  const STEPS = mode === "prep"
    ? ["基本資訊", "前次決議＋業務報告", "提案討論", "產出會前附件"]
    : ["基本資訊", "前次決議＋業務報告", "提案討論", "確認＋下載"];
```

- [ ] **Step 10: Commit**

```bash
git add src/components/skills/workstations/education/spc-meeting/spc-meeting-panel.tsx
git commit -m "feat(education): dual-mode SPC panel — prep/record toggle, auto-save, session loading"
```

---

### Task 11: Update Proposal Form — Ref Files + Conditional Decision Field

**Files:**
- Modify: `src/components/skills/workstations/education/spc-meeting/proposal-form.tsx`

- [ ] **Step 1: Add refFiles to ProposalData and add RefFilePicker**

Update the `ProposalData` interface (line 18-25) to include `refFiles`:

```typescript
export interface ProposalData {
  type: string;
  title: string;
  description: string;
  decision: string;
  students: StudentInfo[];
  refDoc: string;
  refFiles?: Array<{ id: string; path: string; name: string; isDirectory: boolean }>;
}
```

Add import at top:

```typescript
import { RefFilePicker, type RefFile } from "./ref-file-picker";
```

Add `mode` prop to `ProposalFormProps`:

```typescript
interface ProposalFormProps {
  index: number;
  data: ProposalData;
  onChange: (data: ProposalData) => void;
  onRemove: () => void;
  canRemove: boolean;
  mode?: "prep" | "record";
}
```

Update function signature:

```typescript
export function ProposalForm({ index, data, onChange, onRemove, canRemove, mode = "record" }: ProposalFormProps) {
```

- [ ] **Step 2: Add RefFilePicker after 公文字號 field and conditionally hide decision**

After the `公文字號` input (after line 133), add:

```tsx
          <RefFilePicker
            label="案由參考文件（公文、附件等）"
            files={data.refFiles ?? []}
            onChange={(refFiles) => update({ refFiles })}
          />
```

For the decision textarea (lines 178-187), wrap it with a mode check:

```tsx
          {mode === "record" && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-cy-muted">【決議】</label>
              <textarea
                value={data.decision}
                onChange={(e) => update({ decision: e.target.value })}
                placeholder="（會後填入）"
                rows={3}
                className="w-full rounded-md border border-cy-border bg-cy-input px-3 py-2 text-sm text-cy-text focus:border-cy-accent focus:outline-none resize-y"
              />
            </div>
          )}
          {mode === "prep" && (
            <div className="rounded-md bg-cy-input/30 px-3 py-2 text-xs text-cy-muted italic">
              決議將在記錄模式中填寫
            </div>
          )}
```

- [ ] **Step 3: Update panel to pass mode to ProposalForm**

In `spc-meeting-panel.tsx`, update the ProposalForm usage in Step 3:

```tsx
                  <ProposalForm
                    key={i}
                    index={i}
                    data={p}
                    onChange={(data) => updateProposal(i, data)}
                    onRemove={() => removeProposal(i)}
                    canRemove={proposals.length > 1}
                    mode={mode}
                  />
```

- [ ] **Step 4: Update EMPTY_PROPOSAL to include refFiles**

In `spc-meeting-panel.tsx`, update the EMPTY_PROPOSAL (line 25):

```typescript
const EMPTY_PROPOSAL: ProposalData = {
  type: "",
  title: "",
  description: "",
  decision: "",
  students: [],
  refDoc: "",
  refFiles: [],
};
```

- [ ] **Step 5: Commit**

```bash
git add src/components/skills/workstations/education/spc-meeting/proposal-form.tsx \
        src/components/skills/workstations/education/spc-meeting/spc-meeting-panel.tsx
git commit -m "feat(education): proposal form — ref file upload + conditional decision field"
```

---

### Task 12: Update DownloadPanel for HTML URL

**Files:**
- Modify: `src/components/skills/workstations/education/shared/download-panel.tsx`

- [ ] **Step 1: Add htmlUrl support**

Update the `DownloadResult` interface and component:

```typescript
interface DownloadResult {
  docxUrl?: string;
  docxFilename?: string;
  mdPath?: string;
  mocUpdated?: boolean;
  htmlUrl?: string;
}
```

Add after the `.md 已存` section (after line 57):

```tsx
      {result.htmlUrl && (
        <a
          href={result.htmlUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-xs text-cy-accent hover:text-cy-accent/80"
        >
          <Check className="h-3.5 w-3.5 text-green-500" />
          GitHub Pages：{result.htmlUrl}
        </a>
      )}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/skills/workstations/education/shared/download-panel.tsx
git commit -m "feat(education): DownloadPanel shows GitHub Pages URL"
```

---

### Task 13: HTML Template (Python)

**Files:**
- Create: `scripts/education/html_template.py`

- [ ] **Step 1: Create Style-C HTML template**

```python
# scripts/education/html_template.py
"""
Style-C (報紙排版風) HTML template for SPC meeting agenda.
Black/white, bold hierarchy, left border markers.
"""


def generate_agenda_html(record, names_to_mask=None) -> str:
    """Generate a self-contained HTML page for a meeting agenda.

    Args:
        record: MeetingRecord dataclass instance
        names_to_mask: list of full names to mask (if None, no masking)
    """
    from spc_meeting_core import mask_pii

    def m(text):
        """Apply PII masking if names provided."""
        if not names_to_mask or not text:
            return text
        return mask_pii(text, names_to_mask)

    # Build proposals HTML
    proposals_html = ""
    for i, p in enumerate(record.proposals, 1):
        students_html = ""
        if p.students:
            rows = ""
            for s in p.students:
                name = s.get("name", s) if isinstance(s, dict) else str(s)
                cls = s.get("className", "") if isinstance(s, dict) else ""
                disability = s.get("disability", "") if isinstance(s, dict) else ""
                detail = s.get("detail", "") if isinstance(s, dict) else ""
                rows += f"""
                <tr>
                    <td>{m(name)}</td>
                    <td>{cls}</td>
                    <td>{disability}</td>
                    <td>{m(detail)}</td>
                </tr>"""
            students_html = f"""
            <table class="student-table">
                <thead>
                    <tr><th>姓名</th><th>班級</th><th>障別程度</th><th>備註</th></tr>
                </thead>
                <tbody>{rows}</tbody>
            </table>"""

        ref_doc_html = ""
        if p.ref_doc:
            ref_doc_html = f'<p class="ref-doc">公文字號：{p.ref_doc}</p>'

        desc = m(p.description) if p.description else "（待填）"

        proposals_html += f"""
        <div class="proposal">
            <h3>案由{_chinese_num(i)}：{m(p.title or p.type)}</h3>
            {students_html}
            {ref_doc_html}
            <div class="field">
                <div class="field-label">說明</div>
                <div class="field-content">{_nl2br(desc)}</div>
            </div>
            <div class="field">
                <div class="field-label">決議</div>
                <div class="field-content decision-placeholder">待會議決定</div>
            </div>
        </div>"""

    # Committee list
    committee_html = ""
    if record.committee:
        items = []
        for member in record.committee:
            name = member.get("name", "") if isinstance(member, dict) else getattr(member, "name", "")
            title = member.get("title", "") if isinstance(member, dict) else getattr(member, "title", "")
            items.append(f"{title} {m(name)}")
        committee_html = f"""
        <div class="committee">
            <span class="committee-label">出席委員：</span>
            {" ｜ ".join(items)}
        </div>"""

    school = "○○國小"  # Will be filled from SCHOOL_DEFAULTS
    try:
        from spc_meeting_core import SCHOOL_DEFAULTS
        school = f"南投縣{SCHOOL_DEFAULTS['school_name']}國民小學"
    except Exception:
        pass

    prev_tracking = ""
    if record.previous_tracking:
        prev_tracking = f"""
        <div class="section">
            <h2>一、前次會議決議追蹤</h2>
            <div class="section-content">{_nl2br(m(record.previous_tracking))}</div>
        </div>"""

    business = ""
    if record.business_report:
        business = f"""
        <div class="section">
            <h2>二、業務報告</h2>
            <div class="section-content">{_nl2br(m(record.business_report))}</div>
        </div>"""

    proposal_heading_num = "三" if record.previous_tracking and record.business_report else (
        "二" if record.previous_tracking or record.business_report else "一"
    )

    html = f"""<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{record.academic_year}學年度第{record.meeting_number}次特推會議程</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: 'Noto Sans TC', 'Microsoft JhengHei', sans-serif;
            line-height: 1.8;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 32px 24px;
            background: #fff;
        }}
        .header {{
            border-bottom: 2px solid #333;
            padding-bottom: 12px;
            margin-bottom: 24px;
        }}
        .header h1 {{
            font-size: 18px;
            font-weight: 700;
        }}
        .header .subtitle {{
            font-size: 15px;
            font-weight: 600;
            color: #555;
        }}
        .header .meta {{
            font-size: 12px;
            color: #888;
            margin-top: 6px;
        }}
        .committee {{
            font-size: 12px;
            color: #555;
            margin-bottom: 24px;
            padding: 8px 0;
            border-bottom: 1px solid #eee;
        }}
        .committee-label {{
            font-weight: 600;
        }}
        .section {{ margin-bottom: 20px; }}
        .section h2 {{
            font-size: 14px;
            font-weight: 700;
            border-left: 3px solid #333;
            padding-left: 8px;
            margin-bottom: 8px;
        }}
        .section-content {{
            padding-left: 14px;
            font-size: 13px;
            color: #555;
        }}
        .proposal {{
            margin: 12px 0 12px 14px;
            padding: 12px;
            background: #fafafa;
            border-radius: 4px;
        }}
        .proposal h3 {{
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 8px;
        }}
        .field {{
            margin: 8px 0;
        }}
        .field-label {{
            font-size: 12px;
            font-weight: 600;
            color: #333;
        }}
        .field-content {{
            font-size: 13px;
            color: #555;
            padding-left: 8px;
            margin-top: 2px;
        }}
        .decision-placeholder {{
            color: #aaa;
            font-style: italic;
        }}
        .ref-doc {{
            font-size: 12px;
            color: #666;
            margin: 4px 0;
        }}
        .student-table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            margin: 8px 0;
        }}
        .student-table th, .student-table td {{
            border: 1px solid #ddd;
            padding: 4px 8px;
            text-align: left;
        }}
        .student-table th {{
            background: #f5f5f5;
            font-weight: 600;
        }}
        .footer {{
            margin-top: 32px;
            padding-top: 12px;
            border-top: 1px solid #ddd;
            font-size: 11px;
            color: #aaa;
            text-align: center;
        }}
        @media (max-width: 600px) {{
            body {{ padding: 16px 12px; }}
            .header h1 {{ font-size: 16px; }}
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>{school}{record.academic_year}學年度</h1>
        <div class="subtitle">第{record.meeting_number}次特殊教育推行委員會議程</div>
        <div class="meta">
            {record.date} {record.time_start}
            ｜ {record.location}
            ｜ 主席 {m(record.chair)}
            ｜ 記錄 {m(record.recorder)}
        </div>
    </div>

    {committee_html}

    {prev_tracking}
    {business}

    <div class="section">
        <h2>{proposal_heading_num}、提案討論</h2>
        {proposals_html}
    </div>

    <div class="footer">
        Generated by CycloneOS Education Workstation
    </div>
</body>
</html>"""

    return html


CHINESE_NUMS = "一二三四五六七八九十"


def _chinese_num(n: int) -> str:
    if 1 <= n <= len(CHINESE_NUMS):
        return CHINESE_NUMS[n - 1]
    return str(n)


def _nl2br(text: str) -> str:
    """Convert newlines to <br> for HTML display."""
    if not text:
        return ""
    import html as html_mod
    return html_mod.escape(text).replace("\n", "<br>")
```

- [ ] **Step 2: Verify Python syntax**

Run: `python3 -c "import ast; ast.parse(open('scripts/education/html_template.py').read()); print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add scripts/education/html_template.py
git commit -m "feat(education): Style-C HTML template for SPC meeting agenda pages"
```

---

### Task 14: Update Python Core — generate-agenda Action + PII in DOCX

**Files:**
- Modify: `scripts/education/spc_meeting_core.py:780-832`

- [ ] **Step 1: Add generate-agenda action to handle_json_mode**

In `handle_json_mode()`, after the `elif action == "generate":` block (before the `else:` on line 830), insert:

```python
    elif action == "generate-agenda":
        record = build_meeting_record(data)
        names = collect_names(record)

        # Generate masked DOCX (agenda version — decisions blank)
        # Temporarily blank out decisions for agenda
        for p in record.proposals:
            p.decision = "（待會議決定）"

        output_dir = data.get("output_dir", os.path.expanduser("~/Downloads"))
        topics_str = "+".join(p.type for p in record.proposals) if record.proposals else "未分類"
        docx_filename = (
            f"{record.academic_year}-特推會-{record.meeting_number:02d}"
            f"-{topics_str}-議程.docx"
        )
        docx_path = os.path.join(output_dir, docx_filename)
        docx_path = generate_docx(record, docx_path, mask_names=names)

        # Save markdown (with status=agenda-generated)
        md_path = save_markdown(record, status="agenda-generated", mode="prep")

        result = {
            "docx_path": docx_path,
            "md_path": md_path,
            "moc_updated": True,
        }

        # Generate HTML if requested
        if data.get("pushToGitHub"):
            from html_template import generate_agenda_html
            html_content = generate_agenda_html(record, names_to_mask=names)
            result["html_content"] = html_content

        print(json.dumps(result, ensure_ascii=False))
```

- [ ] **Step 2: Update generate_docx to accept mask_names parameter**

Update the function signature (line 557):

```python
def generate_docx(record: MeetingRecord, output_path: str, mask_names: list[str] | None = None) -> str:
```

At the start of the function body (after line 558), add a masking helper:

```python
    def m(text):
        if mask_names and text:
            return mask_pii(text, mask_names)
        return text
```

Then apply `m()` to all text that contains personal info throughout the docx generation. The key places are:
- Student names in proposals
- Committee member names in sign-in sheet
- Chair and recorder names

(The exact line edits depend on the specific add_paragraph calls in the function — the implementer should wrap each student/committee name reference with `m()`)

- [ ] **Step 3: Update save_markdown to accept status and mode parameters**

Update the `save_markdown` function signature:

```python
def save_markdown(record: MeetingRecord, status: str = "record-generated", mode: str = "record") -> str:
```

In `build_markdown`, update the frontmatter to include status and mode. Add after the `tags` line (around line 266):

```python
    frontmatter_lines.append(f'status: "{status}"')
    frontmatter_lines.append(f'mode: "{mode}"')
```

- [ ] **Step 4: Verify Python syntax**

Run: `python3 -c "import ast; ast.parse(open('scripts/education/spc_meeting_core.py').read()); print('OK')"`
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add scripts/education/spc_meeting_core.py
git commit -m "feat(education): generate-agenda action + PII masking in DOCX output"
```

---

### Task 15: Update Generate API Route — Agenda Mode + GitHub Pages

**Files:**
- Modify: `src/app/api/education/spc-meeting/generate/route.ts`

- [ ] **Step 1: Add agenda mode support and GitHub Pages push**

Replace the entire file:

```typescript
// src/app/api/education/spc-meeting/generate/route.ts
import { spawn } from "child_process";
import { join } from "path";
import { readFile } from "fs/promises";
import { homedir } from "os";
import { pushToGitHubPages } from "@/lib/github-pages";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SCRIPT_PATH = join(process.cwd(), "scripts/education/spc_meeting_core.py");
const MEETINGS_REPO = "cyclone-tw/meetings";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action ?? "generate";

    if (!body.academicYear || !body.meetingNumber || !body.proposals?.length) {
      return Response.json({ error: "Missing required meeting data" }, { status: 400 });
    }

    const input = JSON.stringify({
      action,
      ...body,
    });

    const result = await runPython(SCRIPT_PATH, ["--json"], input);
    const parsed = JSON.parse(result);

    // Push HTML to GitHub Pages if requested and content available
    let htmlUrl: string | undefined;
    if (parsed.html_content && body.pushToGitHub) {
      try {
        const year = body.academicYear;
        const num = String(body.meetingNumber).padStart(2, "0");
        const folder = `spc/${year}-${num}`;

        const pushResult = await pushToGitHubPages({
          repo: MEETINGS_REPO,
          folder,
          files: [{ name: "index.html", content: parsed.html_content }],
          commitMessage: `Add SPC meeting ${year}-${num} agenda`,
        });
        htmlUrl = pushResult.url;
      } catch (e) {
        console.error("GitHub Pages push failed:", e);
      }
    }

    if (parsed.docx_path) {
      const docxBuffer = await readFile(parsed.docx_path);
      const filename = parsed.docx_path.split("/").pop() ?? "meeting.docx";

      return new Response(docxBuffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
          "X-Md-Path": parsed.md_path ?? "",
          "X-Moc-Updated": parsed.moc_updated ? "true" : "false",
          ...(htmlUrl ? { "X-Html-Url": htmlUrl } : {}),
        },
      });
    }

    return Response.json(parsed);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

function runPython(script: string, args: string[], stdin: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("python3", [script, ...args], {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: process.cwd(),
      env: { ...process.env, HOME: homedir() },
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data: Buffer) => { stdout += data.toString(); });
    proc.stderr.on("data", (data: Buffer) => { stderr += data.toString(); });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`Python script exited with code ${code}: ${stderr}`));
      }
    });

    proc.on("error", reject);

    proc.stdin.write(stdin);
    proc.stdin.end();
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/education/spc-meeting/generate/route.ts
git commit -m "feat(education): generate API supports agenda mode + GitHub Pages push"
```

---

### Task 16: Integration Verification

- [ ] **Step 1: Verify TypeScript compilation**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No new errors from our changes

- [ ] **Step 2: Verify Python modules**

Run: `python3 -c "import ast; ast.parse(open('scripts/education/spc_meeting_core.py').read()); ast.parse(open('scripts/education/html_template.py').read()); print('All OK')"`
Expected: `All OK`

- [ ] **Step 3: Test dev server starts**

Run: `npx next build 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 4: Manual smoke test checklist**

Open `http://localhost:3000` → 教育工作站 → 特推會會議：
1. Mode toggle visible (備會模式 / 記錄模式)
2. Prep mode: decision fields hidden, Step 4 says "產出會前附件"
3. Record mode: decision fields visible, Step 4 says "生成會議記錄" (existing behavior)
4. Session loader appears when draft .md exists
5. Auto-save triggers on step change
6. Ref file picker works (drag + browse)
7. GitHub Pages checkbox in prep mode Step 4

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(education): integration fixes for SPC meeting Phase 2"
```
