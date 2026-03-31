# Documents Workstation Phase 2A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Documents workstation MVP — local files → AI processing → Markdown output, with left/right split layout, drag-drop source input, and AI chat.

**Architecture:** Left panel (source list + output config + process button) | Right panel (Markdown preview + AI chat). Zustand store manages document sessions. Two API routes: `/api/documents/browse` for local file browsing, `/api/documents/process` for AI processing via Claude CLI.

**Tech Stack:** Next.js App Router, React 19, Zustand, Tailwind CSS v4, lucide-react icons, react-markdown + remark-gfm + rehype-highlight

**Design spec:** `docs/superpowers/specs/2026-03-26-documents-workstation-design.md`

---

## File Structure

| File | Responsibility |
|------|---------------|
| `dashboard/src/stores/documents-store.ts` | Zustand store: sessions, sources, outputs, chat messages |
| `dashboard/src/components/skills/workstations/documents/documents-workstation.tsx` | Main component: left/right split layout, orchestration |
| `dashboard/src/components/skills/workstations/documents/documents-source-panel.tsx` | Left panel: source list + output config + process button |
| `dashboard/src/components/skills/workstations/documents/source-list.tsx` | Drag-drop zone + source items with remove |
| `dashboard/src/components/skills/workstations/documents/output-config.tsx` | Output format checkboxes + output path |
| `dashboard/src/components/skills/workstations/documents/documents-preview.tsx` | Right upper: Markdown preview with react-markdown |
| `dashboard/src/components/skills/workstations/documents/documents-chat.tsx` | Right lower: AI chat for refinement commands |
| `dashboard/src/app/api/documents/browse/route.ts` | GET: browse local filesystem directories |
| `dashboard/src/app/api/documents/process/route.ts` | POST: read source files + call Claude → stream Markdown |
| `dashboard/src/components/skills/skills-panel.tsx` | Modify: wire `activeWorkstation === "documents"` to real component |

---

### Task 1: Zustand Store — `documents-store.ts`

**Files:**
- Create: `dashboard/src/stores/documents-store.ts`

**Context:** Follow existing pattern from `drive-store.ts` and `gmail-store.ts`. No persistence for Phase 2A (add in 2D).

- [ ] **Step 1: Create the store**

```typescript
// dashboard/src/stores/documents-store.ts
import { create } from "zustand";

export type OutputFormat = "md" | "docx" | "pdf" | "html-slides" | "pptx" | "xlsx";
export type SessionStatus = "configuring" | "processing" | "completed";

export interface SourceItem {
  id: string;
  type: "local" | "drive" | "notion" | "obsidian";
  path: string;
  name: string;
  isDirectory: boolean;
}

export interface DocChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface DocumentSession {
  id: string;
  name: string;
  status: SessionStatus;
  createdAt: number;
  sources: SourceItem[];
  outputFormats: OutputFormat[];
  outputPath: string;
  outputContent: string; // generated Markdown content
  chatHistory: DocChatMessage[];
}

interface DocumentsState {
  currentSession: DocumentSession | null;
  isProcessing: boolean;
  error: string | null;

  // Session
  newSession: () => void;

  // Sources
  addSources: (sources: SourceItem[]) => void;
  removeSource: (id: string) => void;

  // Output
  toggleFormat: (format: OutputFormat) => void;
  setOutputPath: (path: string) => void;

  // Processing
  setProcessing: (processing: boolean) => void;
  setOutputContent: (content: string) => void;
  appendOutputContent: (chunk: string) => void;
  setError: (error: string | null) => void;

  // Chat
  addChatMessage: (msg: DocChatMessage) => void;
}

function createSession(): DocumentSession {
  return {
    id: crypto.randomUUID(),
    name: "新工作",
    status: "configuring",
    createdAt: Date.now(),
    sources: [],
    outputFormats: ["md"],
    outputPath: "~/Desktop",
    outputContent: "",
    chatHistory: [],
  };
}

export const useDocumentsStore = create<DocumentsState>((set, get) => ({
  currentSession: null,
  isProcessing: false,
  error: null,

  newSession: () => set({ currentSession: createSession(), isProcessing: false, error: null }),

  addSources: (sources) => {
    const session = get().currentSession;
    if (!session) return;
    const existing = new Set(session.sources.map((s) => s.path));
    const newSources = sources.filter((s) => !existing.has(s.path));
    set({
      currentSession: { ...session, sources: [...session.sources, ...newSources] },
    });
  },

  removeSource: (id) => {
    const session = get().currentSession;
    if (!session) return;
    set({
      currentSession: { ...session, sources: session.sources.filter((s) => s.id !== id) },
    });
  },

  toggleFormat: (format) => {
    const session = get().currentSession;
    if (!session) return;
    const formats = session.outputFormats.includes(format)
      ? session.outputFormats.filter((f) => f !== format)
      : [...session.outputFormats, format];
    set({ currentSession: { ...session, outputFormats: formats } });
  },

  setOutputPath: (path) => {
    const session = get().currentSession;
    if (!session) return;
    set({ currentSession: { ...session, outputPath: path } });
  },

  setProcessing: (processing) => {
    const session = get().currentSession;
    if (!session) return;
    set({
      isProcessing: processing,
      currentSession: { ...session, status: processing ? "processing" : session.status },
    });
  },

  setOutputContent: (content) => {
    const session = get().currentSession;
    if (!session) return;
    set({
      currentSession: { ...session, outputContent: content, status: "completed" },
    });
  },

  appendOutputContent: (chunk) => {
    const session = get().currentSession;
    if (!session) return;
    set({
      currentSession: { ...session, outputContent: session.outputContent + chunk },
    });
  },

  setError: (error) => set({ error }),

  addChatMessage: (msg) => {
    const session = get().currentSession;
    if (!session) return;
    set({
      currentSession: { ...session, chatHistory: [...session.chatHistory, msg] },
    });
  },
}));
```

- [ ] **Step 2: Verify build**

Run: `cd dashboard && npx next build --no-lint 2>&1 | tail -5`
Expected: Build success (store is tree-shaken if unused)

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/stores/documents-store.ts
git commit -m "feat(documents): add Zustand store for document sessions"
```

---

### Task 2: Browse API — `/api/documents/browse`

**Files:**
- Create: `dashboard/src/app/api/documents/browse/route.ts`

**Context:** Similar to Drive's list API but simpler — browses local filesystem only. Must prevent path traversal. Uses `fs/promises` directly (no StorageProvider needed for local-only).

- [ ] **Step 1: Create the route**

```typescript
// dashboard/src/app/api/documents/browse/route.ts
import { NextRequest } from "next/server";
import { readdir, stat } from "fs/promises";
import { join, resolve, basename } from "path";
import { homedir } from "os";

export const dynamic = "force-dynamic";

function expandHome(p: string): string {
  if (p.startsWith("~/") || p === "~") return join(homedir(), p.slice(1));
  return p;
}

export async function GET(request: NextRequest) {
  const dirPath = request.nextUrl.searchParams.get("path") ?? "~";
  const absPath = resolve(expandHome(dirPath));

  // Security: block common dangerous paths
  const blocked = ["/etc", "/var", "/usr", "/bin", "/sbin", "/System", "/private"];
  if (blocked.some((b) => absPath.startsWith(b))) {
    return Response.json({ error: "Forbidden path" }, { status: 403 });
  }

  try {
    const entries = await readdir(absPath, { withFileTypes: true });
    const items = await Promise.all(
      entries
        .filter((e) => !e.name.startsWith("."))
        .map(async (e) => {
          const fullPath = join(absPath, e.name);
          try {
            const s = await stat(fullPath);
            return {
              name: e.name,
              path: fullPath,
              isDirectory: e.isDirectory(),
              size: s.size,
              modifiedAt: s.mtime.toISOString(),
            };
          } catch {
            return null;
          }
        })
    );

    const filtered = items.filter(Boolean);
    // Sort: directories first, then by name
    filtered.sort((a, b) => {
      if (a!.isDirectory !== b!.isDirectory) return a!.isDirectory ? -1 : 1;
      return a!.name.localeCompare(b!.name);
    });

    return Response.json({
      path: absPath,
      parent: resolve(absPath, ".."),
      items: filtered,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify build**

Run: `cd dashboard && npx next build --no-lint 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/app/api/documents/browse/route.ts
git commit -m "feat(documents): add local filesystem browse API"
```

---

### Task 3: Process API — `/api/documents/process`

**Files:**
- Create: `dashboard/src/app/api/documents/process/route.ts`

**Context:** Reads source files, builds a prompt, calls Claude CLI via spawn, streams the response as SSE. Follow the pattern from `/api/agents/dispatch` but simpler.

- [ ] **Step 1: Create the route**

```typescript
// dashboard/src/app/api/documents/process/route.ts
import { NextRequest } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import { spawn } from "child_process";
import { join, resolve, dirname, basename } from "path";
import { homedir } from "os";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function expandHome(p: string): string {
  if (p.startsWith("~/") || p === "~") return join(homedir(), p.slice(1));
  return p;
}

interface ProcessRequest {
  sources: Array<{ path: string; name: string; isDirectory: boolean }>;
  taskDescription: string;
  outputFormats: string[];
  outputPath: string;
}

export async function POST(request: NextRequest) {
  const body: ProcessRequest = await request.json();
  const { sources, taskDescription, outputFormats, outputPath } = body;

  if (!sources?.length) {
    return Response.json({ error: "No sources provided" }, { status: 400 });
  }

  // Read all source file contents
  const fileContents: string[] = [];
  for (const src of sources) {
    try {
      const absPath = resolve(expandHome(src.path));
      const content = await readFile(absPath, "utf-8");
      fileContents.push(`--- FILE: ${src.name} ---\n${content}\n`);
    } catch (e) {
      fileContents.push(`--- FILE: ${src.name} ---\n[Error reading file: ${e instanceof Error ? e.message : "unknown"}]\n`);
    }
  }

  const prompt = [
    "你是一個專業的文件處理助手。以下是使用者提供的來源資料：",
    "",
    fileContents.join("\n"),
    "",
    `使用者需求：${taskDescription || "請根據來源資料產出 Markdown 文件"}`,
    "",
    "請直接產出 Markdown 格式的內容。不要加任何前言或解釋，直接輸出文件內容。",
  ].join("\n");

  // Stream response via Claude CLI
  const stream = new ReadableStream({
    start(controller) {
      const claude = spawn("claude", ["-p", prompt, "--output-format", "stream-json"], {
        env: { ...process.env, HOME: homedir() },
      });

      let fullContent = "";

      claude.stdout.on("data", (data: Buffer) => {
        const lines = data.toString().split("\n").filter(Boolean);
        for (const line of lines) {
          try {
            const event = JSON.parse(line);
            if (event.type === "assistant" && event.subtype === "text") {
              const text = event.message?.content?.[0]?.text ?? "";
              if (text) {
                fullContent += text;
                controller.enqueue(
                  new TextEncoder().encode(`data: ${JSON.stringify({ type: "text", content: text })}\n\n`)
                );
              }
            }
          } catch {
            // skip non-JSON lines
          }
        }
      });

      claude.stderr.on("data", (data: Buffer) => {
        console.error("[documents/process stderr]", data.toString());
      });

      claude.on("close", async (code) => {
        // Save output file
        if (fullContent && outputFormats.includes("md")) {
          try {
            const outDir = resolve(expandHome(outputPath));
            await mkdir(outDir, { recursive: true });
            const filename = `output-${Date.now()}.md`;
            await writeFile(join(outDir, filename), fullContent, "utf-8");
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({ type: "saved", path: join(outDir, filename) })}\n\n`
              )
            );
          } catch (e) {
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({ type: "error", content: `Save failed: ${e instanceof Error ? e.message : "unknown"}` })}\n\n`
              )
            );
          }
        }
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
        controller.close();
      });

      claude.on("error", (err) => {
        controller.enqueue(
          new TextEncoder().encode(
            `data: ${JSON.stringify({ type: "error", content: err.message })}\n\n`
          )
        );
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 2: Verify build**

Run: `cd dashboard && npx next build --no-lint 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/app/api/documents/process/route.ts
git commit -m "feat(documents): add AI process API with Claude CLI streaming"
```

---

### Task 4: Source List — `source-list.tsx`

**Files:**
- Create: `dashboard/src/components/skills/workstations/documents/source-list.tsx`

**Context:** Drag-drop zone for files from Finder + list of added sources with remove button. Uses `useDocumentsStore` for state. Uses `cy-glass` styling.

- [ ] **Step 1: Create the component**

```tsx
// dashboard/src/components/skills/workstations/documents/source-list.tsx
"use client";

import { useCallback, useState } from "react";
import { Plus, X, FileText, Folder } from "lucide-react";
import { useDocumentsStore, type SourceItem } from "@/stores/documents-store";

export function SourceList() {
  const { currentSession, addSources, removeSource } = useDocumentsStore();
  const [isDragOver, setIsDragOver] = useState(false);
  const sources = currentSession?.sources ?? [];

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const items: SourceItem[] = [];
      const files = e.dataTransfer.files;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // webkitRelativePath or name for dragged files
        const path = (file as unknown as { path?: string }).path || file.name;
        items.push({
          id: crypto.randomUUID(),
          type: "local",
          path,
          name: file.name,
          isDirectory: false, // File API doesn't expose this reliably
        });
      }
      if (items.length > 0) addSources(items);
    },
    [addSources]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-cy-text">📥 來源</h3>
        <span className="text-xs text-cy-muted">{sources.length} 個</span>
      </div>

      {/* Source items */}
      {sources.length > 0 && (
        <div className="space-y-1">
          {sources.map((src) => (
            <div
              key={src.id}
              className="flex items-center gap-2 rounded-md bg-cy-input/40 px-2.5 py-1.5 text-sm"
            >
              {src.isDirectory ? (
                <Folder className="h-3.5 w-3.5 shrink-0 text-cy-accent" />
              ) : (
                <FileText className="h-3.5 w-3.5 shrink-0 text-cy-muted" />
              )}
              <span className="flex-1 truncate text-cy-text">{src.name}</span>
              <button
                onClick={() => removeSource(src.id)}
                className="shrink-0 rounded p-0.5 text-cy-muted hover:bg-cy-error/20 hover:text-cy-error transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed p-4 transition-colors ${
          isDragOver
            ? "border-cy-accent bg-cy-accent/10 text-cy-accent"
            : "border-cy-border text-cy-muted hover:border-cy-muted/50"
        }`}
      >
        <Plus className="h-5 w-5" />
        <span className="text-xs">拖放檔案到這裡</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/components/skills/workstations/documents/source-list.tsx
git commit -m "feat(documents): add source list with drag-drop support"
```

---

### Task 5: Output Config — `output-config.tsx`

**Files:**
- Create: `dashboard/src/components/skills/workstations/documents/output-config.tsx`

- [ ] **Step 1: Create the component**

```tsx
// dashboard/src/components/skills/workstations/documents/output-config.tsx
"use client";

import { useDocumentsStore, type OutputFormat } from "@/stores/documents-store";

const FORMAT_OPTIONS: { value: OutputFormat; label: string; enabled: boolean }[] = [
  { value: "md", label: "Markdown (.md)", enabled: true },
  { value: "docx", label: "DOCX (.docx)", enabled: false },
  { value: "pdf", label: "PDF (.pdf)", enabled: false },
  { value: "html-slides", label: "HTML 簡報", enabled: false },
  { value: "pptx", label: "PPTX (.pptx)", enabled: false },
  { value: "xlsx", label: "Excel (.xlsx)", enabled: false },
];

export function OutputConfig() {
  const { currentSession, toggleFormat, setOutputPath } = useDocumentsStore();
  const formats = currentSession?.outputFormats ?? [];
  const outputPath = currentSession?.outputPath ?? "~/Desktop";

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-cy-text">📤 輸出</h3>

      {/* Format checkboxes */}
      <div className="space-y-1.5">
        {FORMAT_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={`flex items-center gap-2 text-sm ${
              opt.enabled ? "cursor-pointer text-cy-text" : "cursor-not-allowed text-cy-muted/50"
            }`}
          >
            <input
              type="checkbox"
              checked={formats.includes(opt.value)}
              onChange={() => opt.enabled && toggleFormat(opt.value)}
              disabled={!opt.enabled}
              className="h-3.5 w-3.5 rounded border-cy-border accent-cy-accent"
            />
            {opt.label}
            {!opt.enabled && <span className="text-xs text-cy-muted/40">Soon</span>}
          </label>
        ))}
      </div>

      {/* Output path */}
      <div className="space-y-1">
        <label className="text-xs text-cy-muted">存放路徑</label>
        <input
          type="text"
          value={outputPath}
          onChange={(e) => setOutputPath(e.target.value)}
          className="w-full rounded-md bg-cy-input/50 px-2.5 py-1.5 text-sm text-cy-text outline-none focus:ring-1 focus:ring-cy-accent/40"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/components/skills/workstations/documents/output-config.tsx
git commit -m "feat(documents): add output format config component"
```

---

### Task 6: Source Panel (Left Side) — `documents-source-panel.tsx`

**Files:**
- Create: `dashboard/src/components/skills/workstations/documents/documents-source-panel.tsx`

**Context:** Composes SourceList + OutputConfig + Process button. Left column of the workstation.

- [ ] **Step 1: Create the component**

```tsx
// dashboard/src/components/skills/workstations/documents/documents-source-panel.tsx
"use client";

import { useState } from "react";
import { Play, Loader2 } from "lucide-react";
import { useDocumentsStore } from "@/stores/documents-store";
import { SourceList } from "./source-list";
import { OutputConfig } from "./output-config";

export function DocumentsSourcePanel() {
  const { currentSession, isProcessing, setProcessing, appendOutputContent, setOutputContent, setError } =
    useDocumentsStore();
  const [taskDesc, setTaskDesc] = useState("");

  const sources = currentSession?.sources ?? [];
  const formats = currentSession?.outputFormats ?? [];
  const canProcess = sources.length > 0 && formats.length > 0 && !isProcessing;

  const handleProcess = async () => {
    if (!currentSession || !canProcess) return;
    setProcessing(true);
    setError(null);
    // Clear previous output
    setOutputContent("");

    try {
      const res = await fetch("/api/documents/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sources: currentSession.sources,
          taskDescription: taskDesc,
          outputFormats: currentSession.outputFormats,
          outputPath: currentSession.outputPath,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Processing failed");
        setProcessing(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError("No response stream");
        setProcessing(false);
        return;
      }

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "text") {
              appendOutputContent(event.content);
            } else if (event.type === "error") {
              setError(event.content);
            }
          } catch {
            // skip
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <SourceList />

      {/* Task description */}
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-cy-text">📝 任務描述</h3>
        <textarea
          value={taskDesc}
          onChange={(e) => setTaskDesc(e.target.value)}
          placeholder="描述你想做什麼...（選填）"
          rows={3}
          className="w-full resize-none rounded-md bg-cy-input/50 px-2.5 py-2 text-sm text-cy-text placeholder:text-cy-muted/60 outline-none focus:ring-1 focus:ring-cy-accent/40"
        />
      </div>

      <OutputConfig />

      {/* Process button */}
      <button
        onClick={handleProcess}
        disabled={!canProcess}
        className={`mt-auto flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all ${
          canProcess
            ? "bg-cy-accent text-cy-bg hover:bg-cy-accent/90"
            : "bg-cy-input/50 text-cy-muted cursor-not-allowed"
        }`}
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            處理中...
          </>
        ) : (
          <>
            <Play className="h-4 w-4" />
            開始處理
          </>
        )}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/components/skills/workstations/documents/documents-source-panel.tsx
git commit -m "feat(documents): add source panel with process trigger"
```

---

### Task 7: Markdown Preview — `documents-preview.tsx`

**Files:**
- Create: `dashboard/src/components/skills/workstations/documents/documents-preview.tsx`

**Context:** Renders the AI-generated Markdown output using react-markdown (already a dependency — used by message-bubble.tsx). Shows empty state when no output yet.

- [ ] **Step 1: Create the component**

```tsx
// dashboard/src/components/skills/workstations/documents/documents-preview.tsx
"use client";

import { FileText } from "lucide-react";
import { useDocumentsStore } from "@/stores/documents-store";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

export function DocumentsPreview() {
  const { currentSession, isProcessing } = useDocumentsStore();
  const content = currentSession?.outputContent ?? "";

  if (!content && !isProcessing) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-cy-muted">
        <FileText className="h-10 w-10 opacity-30" />
        <p className="text-sm">配置來源後按「開始處理」</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      {isProcessing && !content && (
        <div className="flex items-center gap-2 text-sm text-cy-accent">
          <div className="h-2 w-2 animate-pulse rounded-full bg-cy-accent" />
          AI 正在處理...
        </div>
      )}
      {content && (
        <article className="prose prose-invert prose-sm max-w-none prose-headings:text-cy-text prose-p:text-cy-text prose-a:text-cy-accent prose-strong:text-cy-text prose-code:text-cy-accent/80 prose-pre:bg-cy-input/50 prose-pre:border prose-pre:border-cy-border">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
            {content}
          </ReactMarkdown>
        </article>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/components/skills/workstations/documents/documents-preview.tsx
git commit -m "feat(documents): add Markdown preview component"
```

---

### Task 8: AI Chat — `documents-chat.tsx`

**Files:**
- Create: `dashboard/src/components/skills/workstations/documents/documents-chat.tsx`

**Context:** Minimal chat for refinement commands. Not full chat-panel — simpler, inline, uses the documents store for messages. Phase 2A: display-only (chat input sends to process API for refinement in future phases).

- [ ] **Step 1: Create the component**

```tsx
// dashboard/src/components/skills/workstations/documents/documents-chat.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { useDocumentsStore, type DocChatMessage } from "@/stores/documents-store";

export function DocumentsChat() {
  const { currentSession, addChatMessage, appendOutputContent, setError } = useDocumentsStore();
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messages = currentSession?.chatHistory ?? [];
  const hasOutput = !!currentSession?.outputContent;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const handleSend = async () => {
    if (!input.trim() || isSending || !hasOutput || !currentSession) return;

    const userMsg: DocChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      timestamp: Date.now(),
    };
    addChatMessage(userMsg);
    setInput("");
    setIsSending(true);

    try {
      const res = await fetch("/api/documents/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sources: currentSession.sources,
          taskDescription: `以下是目前的文件內容：\n\n${currentSession.outputContent}\n\n使用者的修改指令：${userMsg.content}\n\n請根據指令修改文件，直接輸出完整的修改後 Markdown 內容。`,
          outputFormats: currentSession.outputFormats,
          outputPath: currentSession.outputPath,
        }),
      });

      if (!res.ok) {
        setError("Chat request failed");
        setIsSending(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) { setIsSending(false); return; }

      let fullResponse = "";
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "text") fullResponse += event.content;
          } catch { /* skip */ }
        }
      }

      if (fullResponse) {
        // Replace output with refined version
        const { setOutputContent } = useDocumentsStore.getState();
        setOutputContent(fullResponse);
        addChatMessage({
          id: crypto.randomUUID(),
          role: "assistant",
          content: "已根據你的指令更新文件。",
          timestamp: Date.now(),
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat error");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex h-full flex-col border-t border-cy-border">
      <div className="px-3 py-2">
        <h3 className="text-xs font-medium text-cy-muted">🤖 AI 微調</h3>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 space-y-2">
        {messages.length === 0 && (
          <p className="py-4 text-center text-xs text-cy-muted/60">
            {hasOutput ? "輸入指令微調文件內容" : "先產出文件後，才能使用 AI 微調"}
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-lg px-3 py-2 text-sm ${
              msg.role === "user"
                ? "ml-8 bg-cy-accent/15 text-cy-text"
                : "mr-8 bg-cy-input/50 text-cy-text"
            }`}
          >
            {msg.content}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 border-t border-cy-border p-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder={hasOutput ? "輸入修改指令..." : "請先產出文件"}
          disabled={!hasOutput || isSending}
          className="flex-1 rounded-md bg-cy-input/50 px-2.5 py-1.5 text-sm text-cy-text placeholder:text-cy-muted/50 outline-none disabled:opacity-40"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || !hasOutput || isSending}
          className="rounded-md p-1.5 text-cy-accent transition-colors hover:bg-cy-accent/10 disabled:opacity-30"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/components/skills/workstations/documents/documents-chat.tsx
git commit -m "feat(documents): add AI chat for document refinement"
```

---

### Task 9: Main Workstation — `documents-workstation.tsx`

**Files:**
- Create: `dashboard/src/components/skills/workstations/documents/documents-workstation.tsx`

**Context:** Main orchestrator — header with back button, left/right split layout. Auto-creates a new session on mount if none exists. Imports all sub-components.

- [ ] **Step 1: Create the component**

```tsx
// dashboard/src/components/skills/workstations/documents/documents-workstation.tsx
"use client";

import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { useDocumentsStore } from "@/stores/documents-store";
import { DocumentsSourcePanel } from "./documents-source-panel";
import { DocumentsPreview } from "./documents-preview";
import { DocumentsChat } from "./documents-chat";

export function DocumentsWorkstation() {
  const { setActiveWorkstation } = useAppStore();
  const { currentSession, newSession, error } = useDocumentsStore();

  // Auto-create session on mount
  useEffect(() => {
    if (!currentSession) newSession();
  }, [currentSession, newSession]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-cy-border pb-3">
        <button
          onClick={() => setActiveWorkstation(null)}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-cy-muted hover:bg-cy-input/50 hover:text-cy-text transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Skills
        </button>
        <span className="text-lg">📄</span>
        <h1 className="text-lg font-bold text-cy-text">Documents 工作站</h1>
        {error && (
          <span className="ml-auto rounded bg-cy-error/20 px-2 py-0.5 text-xs text-cy-error">
            {error}
          </span>
        )}
      </div>

      {/* Main content: left/right split */}
      <div className="flex flex-1 gap-0 overflow-hidden mt-3">
        {/* Left: Source panel — fixed 280px */}
        <div className="w-[280px] shrink-0 border-r border-cy-border">
          <DocumentsSourcePanel />
        </div>

        {/* Right: Preview + Chat */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Preview — 60% height */}
          <div className="flex-[3] overflow-hidden">
            <DocumentsPreview />
          </div>

          {/* Chat — 40% height */}
          <div className="flex-[2] overflow-hidden">
            <DocumentsChat />
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/components/skills/workstations/documents/documents-workstation.tsx
git commit -m "feat(documents): add main workstation with left/right layout"
```

---

### Task 10: Wire Up — `skills-panel.tsx` Integration

**Files:**
- Modify: `dashboard/src/components/skills/skills-panel.tsx`

**Context:** Replace `WorkstationPlaceholder` with real `DocumentsWorkstation` when `activeWorkstation === "documents"`.

- [ ] **Step 1: Update skills-panel.tsx**

Add import at top:
```tsx
import { DocumentsWorkstation } from "./workstations/documents/documents-workstation";
```

Replace the workstation rendering block (lines 39-47):
```tsx
  if (activeWorkstation) {
    const skill = SKILLS.find((s) => s.id === activeWorkstation);
    if (!skill) return null;

    if (activeWorkstation === "documents") {
      return <DocumentsWorkstation />;
    }

    return <WorkstationPlaceholder skill={skill} />;
  }
```

- [ ] **Step 2: Build & verify**

Run: `cd dashboard && npx next build --no-lint 2>&1 | tail -10`
Expected: Build success

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/skills/skills-panel.tsx
git commit -m "feat(documents): wire workstation into skills panel"
```
