# YT Notes Phase 1 — YouTube 影片處理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a YouTube video processing pipeline — paste a URL, get transcript + AI summary saved to Obsidian and Notion, viewable in CycloneOS Dashboard.

**Architecture:** Next.js API routes trigger a background pipeline: yt-dlp downloads metadata/subtitles/audio → prefer native subs (fallback to Whisper) → LLM generates summary → writes to Obsidian `Draco/yt-notes/` folder + Notion "YT 深度研究" database. Dashboard workstation provides URL input, progress polling, and history browsing.

**Tech Stack:** Next.js 16.2.1 (App Router), yt-dlp + ffmpeg + openai-whisper via child_process spawn, LLM via `src/lib/llm-provider.ts`, Notion REST API, Zustand for frontend state.

**Spec:** `docs/superpowers/specs/2026-04-04-transcription-workstation-design.md`

---

## Existing Infrastructure

- `yt-dlp` v2026.02.04 installed at `/opt/homebrew/bin/yt-dlp`
- `ffmpeg` v8.0.1 installed at `/opt/homebrew/bin/ffmpeg`
- `whisper` **NOT installed** — needs `pip install openai-whisper`
- Existing directories in Obsidian vault `Draco/`: `yt-transcript/`, `yt-audio/`, `yt-archive/`, `cron/yt-summary/`
- Spec specifies new output dir: `Draco/yt-notes/` (consolidated structure)
- No existing tests in the project — skip TDD, use manual + API testing

## File Structure

### New Files

| File | Responsibility |
|------|----------------|
| `src/lib/yt-notes/types.ts` | Shared types for job state, video metadata, processing steps |
| `src/lib/yt-notes/job-manager.ts` | In-memory Map managing job lifecycle (create/update/query) |
| `src/lib/yt-notes/youtube-dl.ts` | yt-dlp wrapper: download metadata, subtitles, audio via child_process |
| `src/lib/yt-notes/transcriber.ts` | Whisper wrapper: transcribe audio when no subtitles available |
| `src/lib/yt-notes/summarizer.ts` | LLM summary generation via llm-provider.ts + prompt template |
| `src/lib/yt-notes/writer.ts` | Write output files to Obsidian vault (summary.md, transcript.md) |
| `src/lib/yt-notes/notion.ts` | Create/update Notion "YT 深度研究" database page |
| `src/lib/yt-notes/pipeline.ts` | Orchestrator: runs full download→transcribe→summarize→save pipeline |
| `src/lib/yt-notes/prompts.ts` | LLM prompt templates (separated from logic per CLAUDE.md rule) |
| `src/app/api/transcribe/youtube/route.ts` | POST handler: accept URL, start pipeline, return jobId |
| `src/app/api/transcribe/status/route.ts` | GET handler: return job status by jobId |
| `src/app/api/notion/yt-notes/route.ts` | POST handler: create Notion page for YT note |
| `src/components/skills/workstations/transcribe/transcribe-workstation.tsx` | Main workstation shell (header + layout) |
| `src/components/skills/workstations/transcribe/yt-input.tsx` | YouTube URL input + submit button |
| `src/components/skills/workstations/transcribe/job-progress.tsx` | Processing progress display with step indicators |
| `src/components/skills/workstations/transcribe/job-history.tsx` | Recent processing history list |

### Modified Files

| File | Changes |
|------|---------|
| `src/components/skills/skills-panel.tsx` | Add routing for `activeWorkstation === "transcribe"` |
| `src/config/paths-config.ts` | Add `ytNotes` path constant |
| `src/types/digest.ts` | Extend `YtEntry` with transcript/note fields |

---

## Task 1: Types & Job Manager

**Files:**
- Create: `src/lib/yt-notes/types.ts`
- Create: `src/lib/yt-notes/job-manager.ts`

- [ ] **Step 1: Create types**

```typescript
// src/lib/yt-notes/types.ts

export type JobStatus = "processing" | "completed" | "failed";
export type JobStep = "downloading" | "transcribing" | "summarizing" | "saving";

export interface VideoMeta {
  videoId: string;
  title: string;
  channel: string;
  channelId: string;
  uploadDate: string;       // YYYY-MM-DD
  duration: string;         // "32:15"
  durationSeconds: number;
  language: string;         // "zh", "en", "ja", etc.
  thumbnailUrl: string;
  url: string;
}

export interface JobResult {
  obsidianPath: string;
  notionUrl: string;
  title: string;
}

export interface Job {
  id: string;
  url: string;
  status: JobStatus;
  step: JobStep;
  meta?: VideoMeta;
  result?: JobResult;
  error?: string;
  createdAt: number;
}
```

- [ ] **Step 2: Create job manager**

```typescript
// src/lib/yt-notes/job-manager.ts

import type { Job, JobStatus, JobStep, JobResult, VideoMeta } from "./types";

const jobs = new Map<string, Job>();

export function createJob(url: string): Job {
  const id = `yt-${Date.now()}`;
  const job: Job = {
    id,
    url,
    status: "processing",
    step: "downloading",
    createdAt: Date.now(),
  };
  jobs.set(id, job);
  return job;
}

export function updateJob(
  id: string,
  update: Partial<Pick<Job, "status" | "step" | "meta" | "result" | "error">>
): void {
  const job = jobs.get(id);
  if (job) Object.assign(job, update);
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function getRecentJobs(limit = 20): Job[] {
  return [...jobs.values()]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/yt-notes/types.ts src/lib/yt-notes/job-manager.ts
git commit -m "feat(yt-notes): add types and in-memory job manager"
```

---

## Task 2: yt-dlp Wrapper

**Files:**
- Create: `src/lib/yt-notes/youtube-dl.ts`
- Modify: `src/config/paths-config.ts`

- [ ] **Step 1: Add ytNotes path to paths-config**

In `src/config/paths-config.ts`, add to the `PATHS` object:

```typescript
// After the existing markdownOutputs line
ytNotes: join(OBSIDIAN_VAULT, "Draco/yt-notes"),
```

Also add `"transcribe"` to the `OutputSource` type (not strictly needed but keeps things consistent).

- [ ] **Step 2: Create yt-dlp wrapper**

```typescript
// src/lib/yt-notes/youtube-dl.ts

import { spawn } from "child_process";
import { mkdir } from "fs/promises";
import { join } from "path";
import { PATHS } from "@/config/paths-config";
import type { VideoMeta } from "./types";

/** Validate YouTube URL and extract video ID */
export function parseYouTubeUrl(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

/** Run a command and return stdout as string */
function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
    proc.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
    proc.on("close", (code) =>
      code === 0 ? resolve(stdout) : reject(new Error(`${cmd} exited ${code}: ${stderr}`))
    );
    proc.on("error", reject);
  });
}

/** Format seconds to "MM:SS" or "H:MM:SS" */
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Sanitize title for filesystem use — keep CJK, alphanumeric, hyphens */
function sanitizeTitle(title: string): string {
  return title
    .replace(/[/\\:*?"<>|]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

export interface DownloadResult {
  meta: VideoMeta;
  outputDir: string;
  audioPath: string;
  subtitlePath: string | null;     // Path to .vtt if downloaded
  subtitleSource: "native" | "auto" | null;
}

/** Download video metadata, subtitles, and audio */
export async function downloadVideo(url: string): Promise<DownloadResult> {
  // 1. Fetch metadata as JSON
  const metaJson = await run("yt-dlp", [
    "--dump-json",
    "--no-download",
    url,
  ]);
  const raw = JSON.parse(metaJson);

  const uploadDate = raw.upload_date
    ? `${raw.upload_date.slice(0, 4)}-${raw.upload_date.slice(4, 6)}-${raw.upload_date.slice(6, 8)}`
    : new Date().toISOString().slice(0, 10);

  const meta: VideoMeta = {
    videoId: raw.id,
    title: raw.title || "Untitled",
    channel: raw.channel || raw.uploader || "",
    channelId: raw.channel_id || "",
    uploadDate,
    duration: formatDuration(raw.duration || 0),
    durationSeconds: raw.duration || 0,
    language: raw.language || detectLanguage(raw),
    thumbnailUrl: raw.thumbnail || "",
    url,
  };

  // 2. Create output directory: Draco/yt-notes/{date}-{title}/
  const dirName = `${uploadDate}-${sanitizeTitle(meta.title)}`;
  const outputDir = join(PATHS.ytNotes, dirName);
  await mkdir(outputDir, { recursive: true });

  // 3. Download audio as MP3
  const audioPath = join(outputDir, `${uploadDate}-${sanitizeTitle(meta.title)}.mp3`);
  await run("yt-dlp", [
    "-x",
    "--audio-format", "mp3",
    "--audio-quality", "5",
    "-o", audioPath,
    url,
  ]);

  // 4. Try to download subtitles (prefer native, then auto-generated)
  let subtitlePath: string | null = null;
  let subtitleSource: "native" | "auto" | null = null;

  // Try native subtitles first
  const subBaseName = join(outputDir, "sub");
  try {
    await run("yt-dlp", [
      "--write-subs",
      "--skip-download",
      "--sub-format", "vtt",
      "--sub-langs", `${meta.language},en,zh-Hant,zh-Hans,zh`,
      "-o", subBaseName,
      url,
    ]);
    const foundSub = await findSubtitleFile(outputDir, "sub");
    if (foundSub) {
      subtitlePath = foundSub;
      subtitleSource = "native";
    }
  } catch {
    // No native subs available
  }

  // Fallback to auto-generated subtitles
  if (!subtitlePath) {
    try {
      await run("yt-dlp", [
        "--write-auto-subs",
        "--skip-download",
        "--sub-format", "vtt",
        "--sub-langs", `${meta.language},en,zh-Hant,zh-Hans,zh`,
        "-o", subBaseName,
        url,
      ]);
      const foundSub = await findSubtitleFile(outputDir, "sub");
      if (foundSub) {
        subtitlePath = foundSub;
        subtitleSource = "auto";
      }
    } catch {
      // No auto subs either — will need Whisper
    }
  }

  return { meta, outputDir, audioPath, subtitlePath, subtitleSource };
}

/** Find a .vtt subtitle file with the given base name prefix */
async function findSubtitleFile(dir: string, baseName: string): Promise<string | null> {
  const { readdir } = await import("fs/promises");
  const files = await readdir(dir);
  const sub = files.find((f) => f.startsWith(baseName) && f.endsWith(".vtt"));
  return sub ? join(dir, sub) : null;
}

/** Detect language from yt-dlp metadata */
function detectLanguage(raw: Record<string, unknown>): string {
  if (raw.language && typeof raw.language === "string") return raw.language;
  // Check title for CJK characters
  const title = (raw.title as string) || "";
  if (/[\u4e00-\u9fff]/.test(title)) return "zh";
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(title)) return "ja";
  if (/[\uac00-\ud7af]/.test(title)) return "ko";
  return "en";
}
```

- [ ] **Step 3: Commit**

```bash
git add src/config/paths-config.ts src/lib/yt-notes/youtube-dl.ts
git commit -m "feat(yt-notes): add yt-dlp wrapper and paths config"
```

---

## Task 3: Transcriber (Subtitle parser + Whisper fallback)

**Files:**
- Create: `src/lib/yt-notes/transcriber.ts`

- [ ] **Step 1: Create transcriber**

```typescript
// src/lib/yt-notes/transcriber.ts

import { readFile } from "fs/promises";
import { spawn } from "child_process";

export interface TranscriptSegment {
  start: string;   // "00:02:30"
  text: string;
}

export interface TranscriptResult {
  segments: TranscriptSegment[];
  fullText: string;
  source: "native" | "auto" | "whisper";
}

/** Parse VTT subtitle file into segments */
export async function parseVtt(vttPath: string): Promise<TranscriptSegment[]> {
  const content = await readFile(vttPath, "utf-8");
  const segments: TranscriptSegment[] = [];
  const lines = content.split("\n");
  let currentTime = "";

  for (const line of lines) {
    // Match timestamp line: 00:00:01.000 --> 00:00:05.000
    const timeMatch = line.match(/^(\d{2}:\d{2}:\d{2})\.\d{3}\s*-->/);
    if (timeMatch) {
      currentTime = timeMatch[1];
      continue;
    }
    // Skip empty, WEBVTT header, and numeric cue lines
    if (!line.trim() || line.startsWith("WEBVTT") || /^\d+$/.test(line.trim())) continue;
    // Skip HTML tags
    const clean = line.replace(/<[^>]+>/g, "").trim();
    if (!clean) continue;

    // Deduplicate: VTT auto-subs often repeat lines
    const last = segments[segments.length - 1];
    if (last && last.text === clean) continue;

    segments.push({ start: currentTime, text: clean });
  }
  return segments;
}

/** Run Whisper on an audio file */
export async function whisperTranscribe(
  audioPath: string,
  language: string
): Promise<TranscriptSegment[]> {
  // whisper outputs to stdout in vtt format with --output_format vtt
  const result = await new Promise<string>((resolve, reject) => {
    const args = [
      audioPath,
      "--model", "base",
      "--language", language === "zh" ? "Chinese" : language,
      "--output_format", "vtt",
      "--output_dir", "/tmp/whisper-out",
    ];
    const proc = spawn("whisper", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
    proc.on("close", async (code) => {
      if (code !== 0) return reject(new Error(`whisper exited ${code}: ${stderr}`));
      // Read the output VTT file
      const { readFile: rf } = await import("fs/promises");
      const { basename, join } = await import("path");
      const base = basename(audioPath, ".mp3");
      const vttPath = join("/tmp/whisper-out", `${base}.vtt`);
      try {
        const content = await rf(vttPath, "utf-8");
        resolve(content);
      } catch {
        reject(new Error("Whisper output file not found"));
      }
    });
    proc.on("error", reject);
  });

  // Parse the VTT content
  const segments: TranscriptSegment[] = [];
  const lines = result.split("\n");
  let currentTime = "";

  for (const line of lines) {
    const timeMatch = line.match(/^(\d{2}:\d{2}:\d{2})\.\d{3}\s*-->/);
    if (timeMatch) {
      currentTime = timeMatch[1];
      continue;
    }
    const clean = line.replace(/<[^>]+>/g, "").trim();
    if (!clean || clean === "WEBVTT" || /^\d+$/.test(clean)) continue;

    const last = segments[segments.length - 1];
    if (last && last.text === clean) continue;

    segments.push({ start: currentTime, text: clean });
  }
  return segments;
}

/** Get transcript: try VTT first, fallback to Whisper */
export async function getTranscript(
  subtitlePath: string | null,
  subtitleSource: "native" | "auto" | null,
  audioPath: string,
  language: string
): Promise<TranscriptResult> {
  // Try subtitle file first
  if (subtitlePath) {
    const segments = await parseVtt(subtitlePath);
    if (segments.length > 0) {
      return {
        segments,
        fullText: segments.map((s) => s.text).join("\n"),
        source: subtitleSource!,
      };
    }
  }

  // Fallback to Whisper
  const segments = await whisperTranscribe(audioPath, language);
  return {
    segments,
    fullText: segments.map((s) => s.text).join("\n"),
    source: "whisper",
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/yt-notes/transcriber.ts
git commit -m "feat(yt-notes): add VTT parser and Whisper transcriber"
```

---

## Task 4: Prompts & Summarizer

**Files:**
- Create: `src/lib/yt-notes/prompts.ts`
- Create: `src/lib/yt-notes/summarizer.ts`

- [ ] **Step 1: Create prompt templates**

```typescript
// src/lib/yt-notes/prompts.ts

import type { VideoMeta } from "./types";

export function buildSummaryPrompt(meta: VideoMeta, transcript: string): string {
  return `你是一位專業的影片摘要分析師。請根據以下 YouTube 影片的逐字稿，產出一份結構化的詳細摘要。

## 影片資訊
- 標題：${meta.title}
- 頻道：${meta.channel}
- 長度：${meta.duration}
- 語言：${meta.language}

## 逐字稿
${transcript}

## 輸出要求

請用繁體中文產出以下結構的摘要（即使原文是英文）：

# ${meta.title}

## 核心概念
- 用 3-5 個重點 bullet points 總結影片最重要的概念

## 章節整理
- 按影片時間軸整理各段落主題，格式為 "MM:SS - 段落標題"，每段附 1-2 句說明

## 實作技巧 / 工具
- 列出影片提到的實用建議、工具、方法

## 關鍵術語
- **術語** — 解釋（列出影片中的專業術語）

## 值得深入的部分
- 列出值得進一步研究或學習的延伸主題

## 對你的啟發
- 從個人學習和應用的角度，提供 2-3 個行動建議

---

注意：
- 章節時間戳盡量對應逐字稿中的實際時間
- 摘要要詳細但精煉，不要逐句翻譯
- 保留原文的專有名詞（技術名詞可附英文）
- 產出的主題標籤（topics）請另外用 JSON 格式列在最後一行，格式：TOPICS_JSON:["主題1","主題2","主題3"]`;
}
```

- [ ] **Step 2: Create summarizer**

```typescript
// src/lib/yt-notes/summarizer.ts

import { getLLMProvider } from "@/lib/llm-provider";
import { buildSummaryPrompt } from "./prompts";
import type { VideoMeta } from "./types";

export interface SummaryResult {
  summaryMarkdown: string;
  topics: string[];
}

/** Generate summary using LLM provider */
export async function generateSummary(
  meta: VideoMeta,
  transcript: string
): Promise<SummaryResult> {
  const provider = getLLMProvider();
  const prompt = buildSummaryPrompt(meta, transcript);

  let fullText = "";
  for await (const event of provider.stream({
    prompt,
    stdinPrompt: true,    // Transcript can be very long
    noMcp: true,           // Don't need MCP tools for summarization
    noVault: true,         // Don't need vault context
    permissionMode: "default",
    appendSystemPrompt: "你是影片摘要分析師。只輸出摘要內容，不要加任何前言或解釋。",
  })) {
    if (event.type === "text" && event.text) {
      fullText += event.text;
    }
    if (event.type === "error") {
      console.error("[summarizer] LLM error:", event.error);
    }
  }

  // Extract topics from the TOPICS_JSON line at the end
  const topics = extractTopics(fullText);

  // Remove the TOPICS_JSON line from the summary
  const summaryMarkdown = fullText
    .replace(/\n*TOPICS_JSON:\[.*\]\s*$/, "")
    .trim();

  return { summaryMarkdown, topics };
}

function extractTopics(text: string): string[] {
  const match = text.match(/TOPICS_JSON:\s*(\[.*\])/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[1]);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    // Parse error
  }
  return [];
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/yt-notes/prompts.ts src/lib/yt-notes/summarizer.ts
git commit -m "feat(yt-notes): add LLM prompt templates and summarizer"
```

---

## Task 5: File Writer (Obsidian output)

**Files:**
- Create: `src/lib/yt-notes/writer.ts`

- [ ] **Step 1: Create writer**

```typescript
// src/lib/yt-notes/writer.ts

import { writeFile } from "fs/promises";
import { join } from "path";
import type { VideoMeta } from "./types";
import type { TranscriptResult } from "./transcriber";

/** Write summary markdown with frontmatter to Obsidian */
export async function writeSummary(
  outputDir: string,
  meta: VideoMeta,
  summaryMarkdown: string,
  topics: string[],
  hasTranscript: boolean
): Promise<string> {
  const fileName = `${meta.uploadDate}-${sanitize(meta.title)}-摘要.md`;
  const filePath = join(outputDir, fileName);

  const topicsYaml = topics.map((t) => `  - "${t}"`).join("\n");

  const content = `---
type: yt-summary
title: "${meta.title}"
channel: "${meta.channel}"
channel_id: "${meta.channelId}"
date: ${meta.uploadDate}
url: "${meta.url}"
lang: ${meta.language}
duration: "${meta.duration}"
source: manual
transcript: ${hasTranscript}
topics:
${topicsYaml}
tags: [draco, yt-summary]
---

![](${meta.url})

${summaryMarkdown}
`;

  await writeFile(filePath, content, "utf-8");
  return filePath;
}

/** Write transcript markdown to Obsidian */
export async function writeTranscript(
  outputDir: string,
  meta: VideoMeta,
  transcript: TranscriptResult
): Promise<string> {
  const fileName = `${meta.uploadDate}-${sanitize(meta.title)}-逐字稿.md`;
  const filePath = join(outputDir, fileName);

  // Format segments with timestamps
  const body = transcript.segments
    .map((s) => (s.start ? `[${s.start}] ${s.text}` : s.text))
    .join("\n");

  const content = `---
type: yt-transcript
title: "${meta.title}"
channel: "${meta.channel}"
date: ${meta.uploadDate}
url: "${meta.url}"
source: ${transcript.source}
---

# ${meta.title} — 逐字稿

${body}
`;

  await writeFile(filePath, content, "utf-8");
  return filePath;
}

function sanitize(title: string): string {
  return title
    .replace(/[/\\:*?"<>|]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/yt-notes/writer.ts
git commit -m "feat(yt-notes): add Obsidian file writer for summary and transcript"
```

---

## Task 6: Notion Integration

**Files:**
- Create: `src/lib/yt-notes/notion.ts`
- Create: `src/app/api/notion/yt-notes/route.ts`

- [ ] **Step 1: Create Notion helper**

```typescript
// src/lib/yt-notes/notion.ts

import type { VideoMeta } from "./types";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

interface CreatePageParams {
  meta: VideoMeta;
  topics: string[];
  summaryMarkdown: string;
  obsidianPath: string;
}

/** Create a page in the YT 深度研究 Notion database */
export async function createNotionPage(params: CreatePageParams): Promise<string | null> {
  const apiKey = process.env.NOTION_API_KEY;
  const databaseId = process.env.NOTION_YT_NOTES_DATABASE_ID;

  if (!apiKey || !databaseId) {
    console.warn("[notion] Missing NOTION_API_KEY or NOTION_YT_NOTES_DATABASE_ID");
    return null;
  }

  const { meta, topics, summaryMarkdown, obsidianPath } = params;

  const body = {
    parent: { database_id: databaseId },
    properties: {
      Title: { title: [{ text: { content: meta.title } }] },
      Channel: { select: { name: meta.channel } },
      URL: { url: meta.url },
      Date: { date: { start: meta.uploadDate } },
      Duration: { rich_text: [{ text: { content: meta.duration } }] },
      Language: { select: { name: meta.language } },
      Topics: { multi_select: topics.slice(0, 10).map((t) => ({ name: t })) },
      "Has Transcript": { checkbox: true },
      "Obsidian Path": { rich_text: [{ text: { content: obsidianPath } }] },
      Status: { status: { name: "Done" } },
    },
    children: markdownToBlocks(summaryMarkdown),
  };

  const response = await fetch(`${NOTION_API}/pages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("[notion] Failed to create page:", response.status, err);
    return null;
  }

  const data = await response.json();
  return data.url || null;
}

/** Convert markdown summary into Notion block children (simplified) */
function markdownToBlocks(md: string): object[] {
  const blocks: object[] = [];
  const lines = md.split("\n");

  for (const line of lines) {
    if (!line.trim()) continue;

    // Heading 2
    const h2 = line.match(/^## (.+)/);
    if (h2) {
      blocks.push({
        object: "block",
        type: "heading_2",
        heading_2: { rich_text: [{ text: { content: h2[1] } }] },
      });
      continue;
    }

    // Heading 1
    const h1 = line.match(/^# (.+)/);
    if (h1) {
      blocks.push({
        object: "block",
        type: "heading_1",
        heading_1: { rich_text: [{ text: { content: h1[1] } }] },
      });
      continue;
    }

    // Bullet item
    if (line.startsWith("- ")) {
      blocks.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [{ text: { content: line.slice(2) } }],
        },
      });
      continue;
    }

    // Paragraph (everything else)
    blocks.push({
      object: "block",
      type: "paragraph",
      paragraph: { rich_text: [{ text: { content: line } }] },
    });
  }

  // Notion API limits to 100 children per request
  return blocks.slice(0, 100);
}
```

- [ ] **Step 2: Create Notion API route**

```typescript
// src/app/api/notion/yt-notes/route.ts

import { createNotionPage } from "@/lib/yt-notes/notion";
import type { VideoMeta } from "@/lib/yt-notes/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { meta, topics, summaryMarkdown, obsidianPath } = body as {
      meta: VideoMeta;
      topics: string[];
      summaryMarkdown: string;
      obsidianPath: string;
    };

    const notionUrl = await createNotionPage({ meta, topics, summaryMarkdown, obsidianPath });

    if (!notionUrl) {
      return Response.json(
        { error: "Notion not configured or API error" },
        { status: 502 }
      );
    }

    return Response.json({ url: notionUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/yt-notes/notion.ts src/app/api/notion/yt-notes/route.ts
git commit -m "feat(yt-notes): add Notion integration and API route"
```

---

## Task 7: Pipeline Orchestrator

**Files:**
- Create: `src/lib/yt-notes/pipeline.ts`

- [ ] **Step 1: Create pipeline**

```typescript
// src/lib/yt-notes/pipeline.ts

import { updateJob } from "./job-manager";
import { parseYouTubeUrl, downloadVideo } from "./youtube-dl";
import { getTranscript } from "./transcriber";
import { generateSummary } from "./summarizer";
import { writeSummary, writeTranscript } from "./writer";
import { createNotionPage } from "./notion";
import type { Job } from "./types";

/** Run the full YouTube processing pipeline in background */
export async function runPipeline(job: Job): Promise<void> {
  try {
    // Validate URL
    const videoId = parseYouTubeUrl(job.url);
    if (!videoId) {
      updateJob(job.id, { status: "failed", error: "Invalid YouTube URL" });
      return;
    }

    // Step 1: Download
    updateJob(job.id, { step: "downloading" });
    const download = await downloadVideo(job.url);
    updateJob(job.id, { meta: download.meta });

    // Step 2: Transcribe
    updateJob(job.id, { step: "transcribing" });
    const transcript = await getTranscript(
      download.subtitlePath,
      download.subtitleSource,
      download.audioPath,
      download.meta.language
    );

    // Step 3: Summarize
    updateJob(job.id, { step: "summarizing" });
    const summary = await generateSummary(download.meta, transcript.fullText);

    // Step 4: Save
    updateJob(job.id, { step: "saving" });

    // Write to Obsidian
    const summaryPath = await writeSummary(
      download.outputDir,
      download.meta,
      summary.summaryMarkdown,
      summary.topics,
      transcript.segments.length > 0
    );
    await writeTranscript(download.outputDir, download.meta, transcript);

    // Write to Notion (non-blocking — don't fail the job if Notion errors)
    let notionUrl = "";
    try {
      const url = await createNotionPage({
        meta: download.meta,
        topics: summary.topics,
        summaryMarkdown: summary.summaryMarkdown,
        obsidianPath: download.outputDir,
      });
      notionUrl = url || "";
    } catch (e) {
      console.error("[pipeline] Notion write failed (non-fatal):", e);
    }

    // Done
    updateJob(job.id, {
      status: "completed",
      result: {
        obsidianPath: summaryPath,
        notionUrl,
        title: download.meta.title,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[pipeline] Failed:", message);
    updateJob(job.id, { status: "failed", error: message });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/yt-notes/pipeline.ts
git commit -m "feat(yt-notes): add pipeline orchestrator"
```

---

## Task 8: API Routes (youtube + status)

**Files:**
- Create: `src/app/api/transcribe/youtube/route.ts`
- Create: `src/app/api/transcribe/status/route.ts`

- [ ] **Step 1: Create POST /api/transcribe/youtube**

```typescript
// src/app/api/transcribe/youtube/route.ts

import { createJob } from "@/lib/yt-notes/job-manager";
import { parseYouTubeUrl } from "@/lib/yt-notes/youtube-dl";
import { runPipeline } from "@/lib/yt-notes/pipeline";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { url } = (await request.json()) as { url: string };

    if (!url || !parseYouTubeUrl(url)) {
      return Response.json(
        { error: "Invalid or missing YouTube URL" },
        { status: 400 }
      );
    }

    const job = createJob(url);

    // Fire and forget — pipeline runs in background
    runPipeline(job).catch((err) =>
      console.error("[transcribe/youtube] Pipeline error:", err)
    );

    return Response.json({ jobId: job.id, status: job.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create GET /api/transcribe/status**

```typescript
// src/app/api/transcribe/status/route.ts

import { getJob, getRecentJobs } from "@/lib/yt-notes/job-manager";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("jobId");

  // If no jobId, return recent jobs list
  if (!jobId) {
    const jobs = getRecentJobs();
    return Response.json({ jobs });
  }

  const job = getJob(jobId);
  if (!job) {
    return Response.json({ error: "Job not found" }, { status: 404 });
  }

  return Response.json({
    jobId: job.id,
    status: job.status,
    step: job.step,
    meta: job.meta,
    result: job.result,
    error: job.error,
  });
}
```

- [ ] **Step 3: Verify build compiles**

Run: `cd /Users/username/CycloneOS && npx next build 2>&1 | tail -20`

Expected: Build succeeds (or at least the new routes compile without type errors).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/transcribe/youtube/route.ts src/app/api/transcribe/status/route.ts
git commit -m "feat(yt-notes): add transcribe API routes (youtube + status)"
```

---

## Task 9: Transcribe Workstation UI

**Files:**
- Create: `src/components/skills/workstations/transcribe/transcribe-workstation.tsx`
- Create: `src/components/skills/workstations/transcribe/yt-input.tsx`
- Create: `src/components/skills/workstations/transcribe/job-progress.tsx`
- Create: `src/components/skills/workstations/transcribe/job-history.tsx`
- Modify: `src/components/skills/skills-panel.tsx`

- [ ] **Step 1: Create YT URL input component**

```tsx
// src/components/skills/workstations/transcribe/yt-input.tsx
"use client";

import { useState } from "react";
import { Play, Loader2 } from "lucide-react";

interface YtInputProps {
  onSubmit: (url: string) => void;
  disabled?: boolean;
}

export function YtInput({ onSubmit, disabled }: YtInputProps) {
  const [url, setUrl] = useState("");

  const isValid = /(?:youtube\.com\/watch\?v=|youtu\.be\/)/.test(url);

  const handleSubmit = () => {
    if (isValid && !disabled) {
      onSubmit(url);
      setUrl("");
    }
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-cy-text">YouTube 影片連結</label>
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="https://www.youtube.com/watch?v=..."
          className="flex-1 rounded-lg border border-cy-border bg-cy-bg px-3 py-2 text-sm text-cy-text placeholder:text-cy-muted focus:border-cy-accent focus:outline-none"
          disabled={disabled}
        />
        <button
          onClick={handleSubmit}
          disabled={!isValid || disabled}
          className="flex items-center gap-1.5 rounded-lg bg-cy-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-40 hover:bg-cy-accent/90 transition-colors"
        >
          {disabled ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          處理
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create job progress component**

```tsx
// src/components/skills/workstations/transcribe/job-progress.tsx
"use client";

import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";

interface JobProgressProps {
  status: "processing" | "completed" | "failed";
  step: string;
  title?: string;
  error?: string;
}

const STEPS = [
  { key: "downloading", label: "下載影片" },
  { key: "transcribing", label: "取得逐字稿" },
  { key: "summarizing", label: "AI 摘要" },
  { key: "saving", label: "儲存" },
];

export function JobProgress({ status, step, title, error }: JobProgressProps) {
  const currentIdx = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="rounded-lg border border-cy-border bg-cy-card p-4 space-y-3">
      {title && (
        <p className="text-sm font-medium text-cy-text truncate">{title}</p>
      )}

      <div className="flex items-center gap-3">
        {STEPS.map((s, i) => {
          let icon;
          if (status === "failed" && i === currentIdx) {
            icon = <XCircle className="h-4 w-4 text-red-400" />;
          } else if (i < currentIdx || status === "completed") {
            icon = <CheckCircle2 className="h-4 w-4 text-green-400" />;
          } else if (i === currentIdx && status === "processing") {
            icon = <Loader2 className="h-4 w-4 animate-spin text-cy-accent" />;
          } else {
            icon = <Circle className="h-4 w-4 text-cy-muted/40" />;
          }

          return (
            <div key={s.key} className="flex items-center gap-1.5">
              {icon}
              <span
                className={`text-xs ${
                  i <= currentIdx ? "text-cy-text" : "text-cy-muted/60"
                }`}
              >
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <div className="mx-1 h-px w-4 bg-cy-border" />
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create job history component**

```tsx
// src/components/skills/workstations/transcribe/job-history.tsx
"use client";

import { ExternalLink, FileText, CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface HistoryJob {
  id: string;
  status: "processing" | "completed" | "failed";
  step: string;
  meta?: { title: string; channel: string; duration: string; url: string };
  result?: { obsidianPath: string; notionUrl: string; title: string };
  error?: string;
  createdAt: number;
}

interface JobHistoryProps {
  jobs: HistoryJob[];
}

export function JobHistory({ jobs }: JobHistoryProps) {
  if (jobs.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-cy-muted">
        尚無處理紀錄
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-cy-muted">最近處理</h3>
      {jobs.map((job) => (
        <div
          key={job.id}
          className="flex items-center gap-3 rounded-lg border border-cy-border bg-cy-card p-3"
        >
          {/* Status icon */}
          {job.status === "completed" && <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />}
          {job.status === "failed" && <XCircle className="h-4 w-4 shrink-0 text-red-400" />}
          {job.status === "processing" && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-cy-accent" />}

          {/* Info */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-cy-text">
              {job.meta?.title || job.result?.title || job.id}
            </p>
            <p className="text-xs text-cy-muted">
              {job.meta?.channel && `${job.meta.channel} · `}
              {job.meta?.duration || ""}
              {job.error && <span className="text-red-400"> {job.error}</span>}
            </p>
          </div>

          {/* Action links */}
          {job.status === "completed" && job.meta?.url && (
            <a
              href={job.meta.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cy-muted hover:text-cy-text transition-colors"
              title="開啟 YouTube"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
          {job.result?.notionUrl && (
            <a
              href={job.result.notionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cy-muted hover:text-cy-text transition-colors"
              title="開啟 Notion"
            >
              <FileText className="h-4 w-4" />
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create workstation shell**

```tsx
// src/components/skills/workstations/transcribe/transcribe-workstation.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { YtInput } from "./yt-input";
import { JobProgress } from "./job-progress";
import { JobHistory } from "./job-history";

interface JobData {
  id: string;
  status: "processing" | "completed" | "failed";
  step: string;
  meta?: { title: string; channel: string; duration: string; url: string };
  result?: { obsidianPath: string; notionUrl: string; title: string };
  error?: string;
  createdAt: number;
}

export function TranscribeWorkstation() {
  const { setActiveWorkstation } = useAppStore();
  const [activeJob, setActiveJob] = useState<JobData | null>(null);
  const [history, setHistory] = useState<JobData[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch history on mount
  useEffect(() => {
    fetch("/api/transcribe/status")
      .then((r) => r.json())
      .then((data) => {
        if (data.jobs) setHistory(data.jobs);
      })
      .catch(() => {});
  }, []);

  // Poll active job
  useEffect(() => {
    if (!activeJob || activeJob.status !== "processing") return;

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/transcribe/status?jobId=${activeJob.id}`);
        const data = await res.json();
        setActiveJob(data);

        if (data.status !== "processing") {
          if (pollRef.current) clearInterval(pollRef.current);
          // Refresh history
          const histRes = await fetch("/api/transcribe/status");
          const histData = await histRes.json();
          if (histData.jobs) setHistory(histData.jobs);
        }
      } catch {
        // Network error — keep polling
      }
    }, 2000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeJob?.id, activeJob?.status]);

  const handleSubmit = useCallback(async (url: string) => {
    try {
      const res = await fetch("/api/transcribe/youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.jobId) {
        setActiveJob({
          id: data.jobId,
          status: "processing",
          step: "downloading",
          createdAt: Date.now(),
        });
      }
    } catch (err) {
      console.error("Submit error:", err);
    }
  }, []);

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 5.5rem)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-cy-border pb-3">
        <button
          onClick={() => setActiveWorkstation(null)}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-cy-muted hover:bg-cy-input/50 hover:text-cy-text transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Skills
        </button>
        <span className="text-lg">🎙️</span>
        <h1 className="text-lg font-bold text-cy-text">語音轉錄工作站</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto py-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Sub-feature cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border-2 border-cy-accent bg-cy-card p-3 text-center">
              <span className="text-2xl">🎬</span>
              <p className="mt-1 text-xs font-medium text-cy-text">YT 影片</p>
            </div>
            <div className="rounded-lg border border-cy-border bg-cy-card/50 p-3 text-center opacity-50">
              <span className="text-2xl">📱</span>
              <p className="mt-1 text-xs text-cy-muted">手機錄音</p>
              <p className="text-[10px] text-cy-muted">即將推出</p>
            </div>
            <div className="rounded-lg border border-cy-border bg-cy-card/50 p-3 text-center opacity-50">
              <span className="text-2xl">🖥️</span>
              <p className="mt-1 text-xs text-cy-muted">電腦錄影</p>
              <p className="text-[10px] text-cy-muted">即將推出</p>
            </div>
          </div>

          {/* URL Input */}
          <YtInput
            onSubmit={handleSubmit}
            disabled={activeJob?.status === "processing"}
          />

          {/* Active Job Progress */}
          {activeJob && (
            <JobProgress
              status={activeJob.status}
              step={activeJob.step}
              title={activeJob.meta?.title}
              error={activeJob.error}
            />
          )}

          {/* History */}
          <JobHistory
            jobs={history.filter((j) => j.id !== activeJob?.id)}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Wire workstation into skills-panel**

In `src/components/skills/skills-panel.tsx`:

1. Add import at the top:
```typescript
import { TranscribeWorkstation } from "./workstations/transcribe/transcribe-workstation";
```

2. Add routing before the placeholder fallback (after the `felo` check):
```typescript
if (activeWorkstation === "transcribe") {
  return <TranscribeWorkstation />;
}
```

- [ ] **Step 6: Verify build**

Run: `cd /Users/username/CycloneOS && npx next build 2>&1 | tail -30`

Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/components/skills/workstations/transcribe/ src/components/skills/skills-panel.tsx
git commit -m "feat(yt-notes): add transcribe workstation UI with input, progress, and history"
```

---

## Task 10: Integration Test & Polish

**Files:** None new — testing existing code.

- [ ] **Step 1: Install Whisper (if not present)**

```bash
pip install openai-whisper
```

Verify: `whisper --help | head -3`

- [ ] **Step 2: Add env var to .env.local**

Add to `.env.local`:
```
NOTION_YT_NOTES_DATABASE_ID=<user needs to provide this>
```

- [ ] **Step 3: Manual API test**

Start dev server, then test with curl:

```bash
# Submit a short YouTube video
curl -X POST http://localhost:3000/api/transcribe/youtube \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'

# Poll status (replace with actual jobId)
curl "http://localhost:3000/api/transcribe/status?jobId=yt-XXXXX"
```

Expected: Job goes through downloading → transcribing → summarizing → saving → completed.

- [ ] **Step 4: Verify Obsidian output**

Check that files were created:
```bash
ls -la ~/Library/CloudStorage/GoogleDrive-user@gmail.com/我的雲端硬碟/Obsidian-Cyclone/Draco/yt-notes/
```

Expected: A directory with summary.md, transcript.md, and .mp3 file.

- [ ] **Step 5: Verify Dashboard UI**

Open http://localhost:3000, navigate to Skills → 語音轉錄工作站, paste a URL, confirm progress shows.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat(yt-notes): Phase 1 complete — YouTube video processing pipeline"
```
