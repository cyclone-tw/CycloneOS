# Dashboard M3.5 — Provider 抽象層 + Drive Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Drive Panel with dual-account Google Drive browsing/CRUD via local filesystem, backed by a provider abstraction layer, and refactor sidebar navigation to support new pages.

**Architecture:** Provider abstraction (`StorageProvider` interface) wraps local filesystem operations for two Google Drive accounts. API routes expose CRUD operations with path traversal protection. Dashboard panel uses a component map instead of if-else chain. New sidebar pages: gmail (stub), drive (functional), pipeline (stub).

**Tech Stack:** Next.js (App Router), TypeScript, Zustand, Node.js `fs/promises`, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-24-dashboard-m3.5-m7-design.md` (Sections 3, 5, 8, 9)

**IMPORTANT:** This Next.js version may have breaking changes. Before writing any route handler or component, check `node_modules/next/dist/docs/` for current API conventions.

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `dashboard/src/config/accounts.ts` | DriveAccount type + DRIVE_ACCOUNTS constant |
| `dashboard/src/lib/providers/types.ts` | FileEntry, StorageProvider interface |
| `dashboard/src/lib/providers/local-drive.ts` | LocalDriveProvider + path validation |
| `dashboard/src/lib/providers/registry.ts` | Provider registry (get provider by account ID) |
| `dashboard/src/app/api/drive/accounts/route.ts` | GET — list available accounts |
| `dashboard/src/app/api/drive/list/route.ts` | GET — list directory contents |
| `dashboard/src/app/api/drive/search/route.ts` | GET — search files by name |
| `dashboard/src/app/api/drive/read/route.ts` | GET — read file content |
| `dashboard/src/app/api/drive/write/route.ts` | POST — write/upload file |
| `dashboard/src/app/api/drive/copy/route.ts` | POST — copy file (cross-account) |
| `dashboard/src/app/api/drive/move/route.ts` | POST — move file (cross-account) |
| `dashboard/src/app/api/drive/mkdir/route.ts` | POST — create directory |
| `dashboard/src/app/api/drive/delete/route.ts` | DELETE — delete file/directory |
| `dashboard/src/stores/drive-store.ts` | Drive panel state (account, path, files, selection) |
| `dashboard/src/components/drive/drive-panel.tsx` | Main drive panel container |
| `dashboard/src/components/drive/file-browser.tsx` | File list with breadcrumb navigation |
| `dashboard/src/components/drive/file-preview.tsx` | File content preview panel |
| `dashboard/src/components/drive/account-switcher.tsx` | Account tab switcher |

### Modified Files

| File | Changes |
|------|---------|
| `dashboard/src/stores/app-store.ts` | Add `"gmail" \| "drive" \| "pipeline"` to SidebarPage, remove `"files"` |
| `dashboard/src/components/layout/sidebar.tsx` | Update NAV_ITEMS (add gmail/drive/pipeline, remove files), remove Calendar from EXTERNAL_LINKS |
| `dashboard/src/components/layout/dashboard-panel.tsx` | Replace if-else chain with component map |

---

## Task 1: Config — DriveAccount type + accounts

**Files:**
- Create: `dashboard/src/config/accounts.ts`

- [ ] **Step 1: Create accounts config**

```typescript
// dashboard/src/config/accounts.ts

export interface DriveAccount {
  id: string;
  email: string;
  label: string;
  localBasePath: string;
  outputFolder: string;
}

export const DRIVE_ACCOUNTS: DriveAccount[] = [
  {
    id: "personal",
    email: "user@gmail.com",
    label: "個人",
    localBasePath:
      "/Users/username/Library/CloudStorage/GoogleDrive-user@gmail.com/我的雲端硬碟",
    outputFolder: "CycloneOS-output",
  },
  {
    id: "school",
    email: "cyclonetw@ksps.ntct.edu.tw",
    label: "學校",
    localBasePath:
      "/Users/username/Library/CloudStorage/GoogleDrive-cyclonetw@ksps.ntct.edu.tw/我的雲端硬碟",
    outputFolder: "CycloneOS-output",
  },
];

export function getAccount(id: string): DriveAccount | undefined {
  return DRIVE_ACCOUNTS.find((a) => a.id === id);
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/config/accounts.ts
git commit -m "feat(dashboard): add DriveAccount config for dual Google Drive accounts"
```

---

## Task 2: Provider Types + StorageProvider Interface

**Files:**
- Create: `dashboard/src/lib/providers/types.ts`

- [ ] **Step 1: Create provider types**

```typescript
// dashboard/src/lib/providers/types.ts

export interface FileEntry {
  name: string;
  path: string; // relative to account base path
  isDirectory: boolean;
  size: number;
  modifiedAt: string; // ISO 8601
  mimeType?: string;
}

export interface StorageProvider {
  readonly id: string;
  readonly name: string;
  readonly accountEmail: string;

  listFiles(dirPath: string): Promise<FileEntry[]>;
  readFile(filePath: string): Promise<Buffer>;
  writeFile(filePath: string, content: Buffer): Promise<void>;
  copyFile(src: string, dest: string): Promise<void>;
  moveFile(src: string, dest: string): Promise<void>;
  deleteFile(filePath: string): Promise<void>;
  search(query: string, dirPath?: string): Promise<FileEntry[]>;
  exists(filePath: string): Promise<boolean>;
  mkdir(dirPath: string): Promise<void>;
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/lib/providers/types.ts
git commit -m "feat(dashboard): add StorageProvider interface and FileEntry type"
```

---

## Task 3: LocalDriveProvider Implementation

**Files:**
- Create: `dashboard/src/lib/providers/local-drive.ts`

- [ ] **Step 1: Implement LocalDriveProvider with path validation**

```typescript
// dashboard/src/lib/providers/local-drive.ts
import path from "path";
import fs from "fs/promises";
import { lookup } from "mime-types";
import type { DriveAccount } from "@/config/accounts";
import type { FileEntry, StorageProvider } from "./types";

/** Resolve and validate path is within account base path (prevents path traversal) */
function validatePath(account: DriveAccount, requestedPath: string): string {
  const basePath = account.localBasePath;
  const resolved = path.resolve(basePath, requestedPath);
  if (!resolved.startsWith(basePath + path.sep) && resolved !== basePath) {
    throw new Error("Path traversal detected");
  }
  return resolved;
}

/** Additional symlink check for existing paths */
async function validateExistingPath(
  account: DriveAccount,
  requestedPath: string
): Promise<string> {
  const resolved = validatePath(account, requestedPath);
  const real = await fs.realpath(resolved);
  if (!real.startsWith(account.localBasePath + path.sep) && real !== account.localBasePath) {
    throw new Error("Symlink points outside allowed directory");
  }
  return real;
}

function toFileEntry(
  name: string,
  relativePath: string,
  stat: { isDirectory: () => boolean; size: number; mtime: Date }
): FileEntry {
  return {
    name,
    path: relativePath,
    isDirectory: stat.isDirectory(),
    size: stat.size,
    modifiedAt: stat.mtime.toISOString(),
    mimeType: stat.isDirectory() ? undefined : lookup(name) || undefined,
  };
}

export class LocalDriveProvider implements StorageProvider {
  readonly id: string;
  readonly name: string;
  readonly accountEmail: string;

  constructor(private account: DriveAccount) {
    this.id = account.id;
    this.name = `Local Drive (${account.label})`;
    this.accountEmail = account.email;
  }

  async listFiles(dirPath: string): Promise<FileEntry[]> {
    const absDir = await validateExistingPath(this.account, dirPath);
    const entries = await fs.readdir(absDir, { withFileTypes: true });
    const results: FileEntry[] = [];

    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue; // skip hidden files
      const entryPath = path.join(absDir, entry.name);
      const stat = await fs.stat(entryPath);
      const relativePath = path.relative(this.account.localBasePath, entryPath);
      results.push(toFileEntry(entry.name, relativePath, stat));
    }

    return results.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name, "zh-Hant");
    });
  }

  async readFile(filePath: string): Promise<Buffer> {
    const abs = await validateExistingPath(this.account, filePath);
    return fs.readFile(abs);
  }

  async writeFile(filePath: string, content: Buffer): Promise<void> {
    const abs = validatePath(this.account, filePath);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content);
  }

  async copyFile(src: string, dest: string): Promise<void> {
    const absSrc = await validateExistingPath(this.account, src);
    const absDest = validatePath(this.account, dest);
    await fs.mkdir(path.dirname(absDest), { recursive: true });
    await fs.cp(absSrc, absDest, { recursive: true });
  }

  async moveFile(src: string, dest: string): Promise<void> {
    const absSrc = await validateExistingPath(this.account, src);
    const absDest = validatePath(this.account, dest);
    await fs.mkdir(path.dirname(absDest), { recursive: true });
    await fs.rename(absSrc, absDest);
  }

  async deleteFile(filePath: string): Promise<void> {
    const abs = await validateExistingPath(this.account, filePath);
    const stat = await fs.stat(abs);
    if (stat.isDirectory()) {
      await fs.rm(abs, { recursive: true });
    } else {
      await fs.unlink(abs);
    }
  }

  async search(query: string, dirPath: string = "."): Promise<FileEntry[]> {
    const absDir = await validateExistingPath(this.account, dirPath);
    const basePath = this.account.localBasePath;
    const results: FileEntry[] = [];
    const lowerQuery = query.toLowerCase();

    async function walk(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.name.toLowerCase().includes(lowerQuery)) {
          const stat = await fs.stat(fullPath);
          const relativePath = path.relative(basePath, fullPath);
          results.push(toFileEntry(entry.name, relativePath, stat));
        }
        if (entry.isDirectory() && results.length < 100) {
          await walk(fullPath);
        }
      }
    }

    await walk(absDir);
    return results.slice(0, 100); // cap results
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      const abs = validatePath(this.account, filePath);
      await fs.access(abs);
      return true;
    } catch {
      return false;
    }
  }

  async mkdir(dirPath: string): Promise<void> {
    const abs = validatePath(this.account, dirPath);
    await fs.mkdir(abs, { recursive: true });
  }
}
```

- [ ] **Step 2: Check if mime-types is already a dependency, install if needed**

```bash
cd dashboard && cat package.json | grep mime-types || npm install mime-types && npm install -D @types/mime-types
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/lib/providers/local-drive.ts dashboard/package.json dashboard/package-lock.json
git commit -m "feat(dashboard): implement LocalDriveProvider with path traversal protection"
```

---

## Task 4: Provider Registry

**Files:**
- Create: `dashboard/src/lib/providers/registry.ts`

- [ ] **Step 1: Create provider registry**

```typescript
// dashboard/src/lib/providers/registry.ts
import { DRIVE_ACCOUNTS, getAccount } from "@/config/accounts";
import { LocalDriveProvider } from "./local-drive";
import type { StorageProvider } from "./types";

const providers = new Map<string, StorageProvider>();

export function getStorageProvider(accountId: string): StorageProvider {
  let provider = providers.get(accountId);
  if (provider) return provider;

  const account = getAccount(accountId);
  if (!account) {
    throw new Error(`Unknown account: ${accountId}`);
  }

  provider = new LocalDriveProvider(account);
  providers.set(accountId, provider);
  return provider;
}

export function getAllAccountIds(): string[] {
  return DRIVE_ACCOUNTS.map((a) => a.id);
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/lib/providers/registry.ts
git commit -m "feat(dashboard): add provider registry for storage providers"
```

---

## Task 5: Drive API Routes — accounts + list + search

**Files:**
- Create: `dashboard/src/app/api/drive/accounts/route.ts`
- Create: `dashboard/src/app/api/drive/list/route.ts`
- Create: `dashboard/src/app/api/drive/search/route.ts`

**Note:** Check `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` for current route handler conventions before writing.

- [ ] **Step 1: Create accounts route**

```typescript
// dashboard/src/app/api/drive/accounts/route.ts
import { DRIVE_ACCOUNTS } from "@/config/accounts";

export const dynamic = "force-dynamic";

export async function GET() {
  const accounts = DRIVE_ACCOUNTS.map(({ id, email, label }) => ({
    id,
    email,
    label,
  }));
  return Response.json({ accounts });
}
```

- [ ] **Step 2: Create list route**

```typescript
// dashboard/src/app/api/drive/list/route.ts
import { NextRequest } from "next/server";
import { getStorageProvider } from "@/lib/providers/registry";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const accountId = searchParams.get("accountId");
  const dirPath = searchParams.get("path") ?? ".";

  if (!accountId) {
    return Response.json({ error: "accountId is required" }, { status: 400 });
  }

  try {
    const provider = getStorageProvider(accountId);
    const files = await provider.listFiles(dirPath);
    return Response.json({ files });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("traversal") || message.includes("Symlink")) {
      return Response.json({ error: "Forbidden path" }, { status: 403 });
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create search route**

```typescript
// dashboard/src/app/api/drive/search/route.ts
import { NextRequest } from "next/server";
import { getStorageProvider } from "@/lib/providers/registry";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const accountId = searchParams.get("accountId");
  const query = searchParams.get("query");
  const dirPath = searchParams.get("path") ?? ".";

  if (!accountId || !query) {
    return Response.json(
      { error: "accountId and query are required" },
      { status: 400 }
    );
  }

  try {
    const provider = getStorageProvider(accountId);
    const files = await provider.search(query, dirPath);
    return Response.json({ files });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("traversal") || message.includes("Symlink")) {
      return Response.json({ error: "Forbidden path" }, { status: 403 });
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 4: Test manually**

```bash
cd dashboard && npm run dev &
# In another terminal:
curl http://localhost:3000/api/drive/accounts
curl "http://localhost:3000/api/drive/list?accountId=personal&path=."
curl "http://localhost:3000/api/drive/search?accountId=personal&query=Obsidian"
```

Expected: JSON responses with account list and file entries.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/app/api/drive/accounts/route.ts dashboard/src/app/api/drive/list/route.ts dashboard/src/app/api/drive/search/route.ts
git commit -m "feat(dashboard): add Drive API routes — accounts, list, search"
```

---

## Task 6: Drive API Routes — read + write + mkdir

**Files:**
- Create: `dashboard/src/app/api/drive/read/route.ts`
- Create: `dashboard/src/app/api/drive/write/route.ts`
- Create: `dashboard/src/app/api/drive/mkdir/route.ts`

- [ ] **Step 1: Create read route**

```typescript
// dashboard/src/app/api/drive/read/route.ts
import { NextRequest } from "next/server";
import { getStorageProvider } from "@/lib/providers/registry";
import { lookup } from "mime-types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const accountId = searchParams.get("accountId");
  const filePath = searchParams.get("path");

  if (!accountId || !filePath) {
    return Response.json(
      { error: "accountId and path are required" },
      { status: 400 }
    );
  }

  try {
    const provider = getStorageProvider(accountId);
    const buffer = await provider.readFile(filePath);
    const mimeType = lookup(filePath) || "application/octet-stream";

    // For text-based files, return as text
    if (mimeType.startsWith("text/") || mimeType === "application/json" || mimeType === "application/javascript") {
      return Response.json({ content: buffer.toString("utf-8"), mimeType });
    }

    // For images, return base64
    if (mimeType.startsWith("image/")) {
      return Response.json({
        content: buffer.toString("base64"),
        mimeType,
        encoding: "base64",
      });
    }

    // For other files, return metadata only
    return Response.json({
      mimeType,
      size: buffer.length,
      downloadHint: "Use the file path directly for large binary files",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("traversal") || message.includes("Symlink")) {
      return Response.json({ error: "Forbidden path" }, { status: 403 });
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create write route**

```typescript
// dashboard/src/app/api/drive/write/route.ts
import { NextRequest } from "next/server";
import { getStorageProvider } from "@/lib/providers/registry";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const accountId = formData.get("accountId") as string;
    const filePath = formData.get("path") as string;
    const file = formData.get("file") as File | null;

    if (!accountId || !filePath || !file) {
      return Response.json(
        { error: "accountId, path, and file are required" },
        { status: 400 }
      );
    }

    const provider = getStorageProvider(accountId);
    const buffer = Buffer.from(await file.arrayBuffer());
    await provider.writeFile(filePath, buffer);

    return Response.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("traversal") || message.includes("Symlink")) {
      return Response.json({ error: "Forbidden path" }, { status: 403 });
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create mkdir route**

```typescript
// dashboard/src/app/api/drive/mkdir/route.ts
import { NextRequest } from "next/server";
import { getStorageProvider } from "@/lib/providers/registry";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { accountId, path: dirPath } = await request.json();

    if (!accountId || !dirPath) {
      return Response.json(
        { error: "accountId and path are required" },
        { status: 400 }
      );
    }

    const provider = getStorageProvider(accountId);
    await provider.mkdir(dirPath);

    return Response.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("traversal") || message.includes("Symlink")) {
      return Response.json({ error: "Forbidden path" }, { status: 403 });
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/app/api/drive/read/route.ts dashboard/src/app/api/drive/write/route.ts dashboard/src/app/api/drive/mkdir/route.ts
git commit -m "feat(dashboard): add Drive API routes — read, write, mkdir"
```

---

## Task 7: Drive API Routes — copy + move + delete

**Files:**
- Create: `dashboard/src/app/api/drive/copy/route.ts`
- Create: `dashboard/src/app/api/drive/move/route.ts`
- Create: `dashboard/src/app/api/drive/delete/route.ts`

- [ ] **Step 1: Create copy route (supports cross-account)**

```typescript
// dashboard/src/app/api/drive/copy/route.ts
import { NextRequest } from "next/server";
import { getStorageProvider } from "@/lib/providers/registry";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { srcAccount, srcPath, destAccount, destPath } =
      await request.json();

    if (!srcAccount || !srcPath || !destAccount || !destPath) {
      return Response.json(
        { error: "srcAccount, srcPath, destAccount, destPath are required" },
        { status: 400 }
      );
    }

    const srcProvider = getStorageProvider(srcAccount);

    if (srcAccount === destAccount) {
      // Same account: use provider's copyFile
      await srcProvider.copyFile(srcPath, destPath);
    } else {
      // Cross-account: read from src, write to dest
      const buffer = await srcProvider.readFile(srcPath);
      const destProvider = getStorageProvider(destAccount);
      await destProvider.writeFile(destPath, buffer);
    }

    return Response.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("traversal") || message.includes("Symlink")) {
      return Response.json({ error: "Forbidden path" }, { status: 403 });
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create move route (supports cross-account)**

```typescript
// dashboard/src/app/api/drive/move/route.ts
import { NextRequest } from "next/server";
import { getStorageProvider } from "@/lib/providers/registry";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { srcAccount, srcPath, destAccount, destPath } =
      await request.json();

    if (!srcAccount || !srcPath || !destAccount || !destPath) {
      return Response.json(
        { error: "srcAccount, srcPath, destAccount, destPath are required" },
        { status: 400 }
      );
    }

    const srcProvider = getStorageProvider(srcAccount);

    if (srcAccount === destAccount) {
      await srcProvider.moveFile(srcPath, destPath);
    } else {
      // Cross-account: copy then delete
      const buffer = await srcProvider.readFile(srcPath);
      const destProvider = getStorageProvider(destAccount);
      await destProvider.writeFile(destPath, buffer);
      await srcProvider.deleteFile(srcPath);
    }

    return Response.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("traversal") || message.includes("Symlink")) {
      return Response.json({ error: "Forbidden path" }, { status: 403 });
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create delete route**

```typescript
// dashboard/src/app/api/drive/delete/route.ts
import { NextRequest } from "next/server";
import { getStorageProvider } from "@/lib/providers/registry";

export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const accountId = searchParams.get("accountId");
  const filePath = searchParams.get("path");

  if (!accountId || !filePath) {
    return Response.json(
      { error: "accountId and path are required" },
      { status: 400 }
    );
  }

  try {
    const provider = getStorageProvider(accountId);
    await provider.deleteFile(filePath);
    return Response.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("traversal") || message.includes("Symlink")) {
      return Response.json({ error: "Forbidden path" }, { status: 403 });
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/app/api/drive/copy/route.ts dashboard/src/app/api/drive/move/route.ts dashboard/src/app/api/drive/delete/route.ts
git commit -m "feat(dashboard): add Drive API routes — copy, move, delete with cross-account support"
```

---

## Task 8: SidebarPage Refactor — app-store + sidebar

**Files:**
- Modify: `dashboard/src/stores/app-store.ts`
- Modify: `dashboard/src/components/layout/sidebar.tsx`

- [ ] **Step 1: Update SidebarPage type in app-store.ts**

Replace the entire file content:

```typescript
// dashboard/src/stores/app-store.ts
import { create } from "zustand";

export type SidebarPage =
  | "overview"
  | "gmail"
  | "drive"
  | "pipeline"
  | "search"
  | "settings";

interface AppState {
  activePage: SidebarPage;
  setActivePage: (page: SidebarPage) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activePage: "overview",
  setActivePage: (page) => set({ activePage: page }),
}));
```

- [ ] **Step 2: Update sidebar.tsx NAV_ITEMS and EXTERNAL_LINKS**

In `sidebar.tsx`, update NAV_ITEMS to:

```typescript
const NAV_ITEMS: { page: SidebarPage; icon: string; label: string }[] = [
  { page: "overview", icon: "🏠", label: "Overview" },
  { page: "gmail", icon: "📧", label: "Gmail" },
  { page: "drive", icon: "💾", label: "Drive" },
  { page: "pipeline", icon: "📄", label: "Documents" },
  { page: "search", icon: "🔍", label: "Search" },
];
```

Update EXTERNAL_LINKS to (remove Calendar):

```typescript
const EXTERNAL_LINKS: { icon: string; label: string; url: string }[] = [
  { icon: "📋", label: "Tasks (Notion)", url: "https://notion.so" },
];
```

- [ ] **Step 3: Verify the app compiles**

```bash
cd dashboard && npx next build 2>&1 | tail -20
```

Expected: Build succeeds (there may be warnings about unused pages, that's OK).

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/stores/app-store.ts dashboard/src/components/layout/sidebar.tsx
git commit -m "refactor(dashboard): add gmail/drive/pipeline pages to sidebar, remove Calendar link"
```

---

## Task 9: Dashboard Panel — Component Map Refactor

**Files:**
- Modify: `dashboard/src/components/layout/dashboard-panel.tsx`

- [ ] **Step 1: Create stub drive-panel.tsx** (needed because DrivePanel is imported here but built later in Tasks 11-12)

```typescript
// dashboard/src/components/drive/drive-panel.tsx
"use client";

export function DrivePanel() {
  return (
    <div>
      <h1 className="text-xl font-bold text-cy-text">Drive</h1>
      <p className="mt-2 text-sm text-cy-muted">Loading Drive panel...</p>
    </div>
  );
}
```

- [ ] **Step 2: Replace if-else chain with component map**

Replace the entire `dashboard-panel.tsx` file. Import DrivePanel stub, use component map pattern:

```typescript
"use client";

import type { ReactNode } from "react";
import { useAppStore, type SidebarPage } from "@/stores/app-store";
import { StatsCards } from "@/components/overview/stats-cards";
import { ActivityTimeline } from "@/components/overview/activity-timeline";
import { OpenClawFeed } from "@/components/overview/openclaw-feed";
import { SessionsFeed } from "@/components/overview/sessions-feed";
import { UpcomingPanel } from "@/components/overview/upcoming-panel";
import { DrivePanel } from "@/components/drive/drive-panel";

function OverviewPage() {
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold text-cy-text">Overview</h1>
      <StatsCards />
      <ActivityTimeline />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <OpenClawFeed />
        <SessionsFeed />
      </div>
      <UpcomingPanel />
    </div>
  );
}

function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h1 className="text-xl font-bold capitalize text-cy-text">{title}</h1>
      <p className="mt-2 text-sm text-cy-muted">{description}</p>
    </div>
  );
}

const PAGE_COMPONENTS: Record<SidebarPage, ReactNode> = {
  overview: <OverviewPage />,
  gmail: <PlaceholderPage title="Gmail" description="Gmail panel — coming in Milestone 4" />,
  drive: <DrivePanel />,
  pipeline: <PlaceholderPage title="Documents" description="Document pipeline — coming in Milestone 5" />,
  search: <PlaceholderPage title="Search" description="Cross-source search — coming in Milestone 4" />,
  settings: <PlaceholderPage title="Settings" description="Settings — coming in Milestone 4" />,
};

export function DashboardPanel() {
  const { activePage } = useAppStore();

  return (
    <div className="flex h-full flex-col overflow-auto bg-cy-bg p-4">
      {PAGE_COMPONENTS[activePage]}
    </div>
  );
}
```

- [ ] **Step 3: Verify the app compiles**

```bash
cd dashboard && npx next build 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/drive/drive-panel.tsx dashboard/src/components/layout/dashboard-panel.tsx
git commit -m "refactor(dashboard): replace if-else chain with component map in DashboardPanel"
```

---

## Task 10: Drive Store (Zustand)

**Files:**
- Create: `dashboard/src/stores/drive-store.ts`

- [ ] **Step 1: Create drive store**

```typescript
// dashboard/src/stores/drive-store.ts
import { create } from "zustand";
import type { FileEntry } from "@/lib/providers/types";

interface DriveState {
  activeAccount: string;
  currentPath: string;
  files: FileEntry[];
  selectedFile: FileEntry | null;
  isLoading: boolean;
  searchQuery: string;
  searchResults: DriveFileEntry[] | null;
  error: string | null;

  setActiveAccount: (accountId: string) => void;
  setCurrentPath: (path: string) => void;
  setFiles: (files: FileEntry[]) => void;
  setSelectedFile: (file: FileEntry | null) => void;
  setIsLoading: (loading: boolean) => void;
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: DriveFileEntry[] | null) => void;
  setError: (error: string | null) => void;
}

export const useDriveStore = create<DriveState>((set) => ({
  activeAccount: "personal",
  currentPath: ".",
  files: [],
  selectedFile: null,
  isLoading: false,
  searchQuery: "",
  searchResults: null,
  error: null,

  setActiveAccount: (accountId) =>
    set({ activeAccount: accountId, currentPath: ".", files: [], selectedFile: null, searchResults: null }),
  setCurrentPath: (path) => set({ currentPath: path, selectedFile: null, searchResults: null }),
  setFiles: (files) => set({ files }),
  setSelectedFile: (file) => set({ selectedFile: file }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSearchResults: (results) => set({ searchResults: results }),
  setError: (error) => set({ error }),
}));
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/stores/drive-store.ts
git commit -m "feat(dashboard): add Zustand drive store for Drive panel state"
```

---

## Task 11: Drive Panel UI — AccountSwitcher + FileBrowser

**Files:**
- Create: `dashboard/src/components/drive/account-switcher.tsx`
- Create: `dashboard/src/components/drive/file-browser.tsx`

- [ ] **Step 1: Create account-switcher.tsx**

```typescript
"use client";

import { useDriveStore } from "@/stores/drive-store";
import { DRIVE_ACCOUNTS } from "@/config/accounts";
import { cn } from "@/lib/utils";

export function AccountSwitcher() {
  const { activeAccount, setActiveAccount } = useDriveStore();

  return (
    <div className="flex gap-1 rounded-lg bg-cy-card p-1">
      {DRIVE_ACCOUNTS.map((account) => (
        <button
          key={account.id}
          onClick={() => setActiveAccount(account.id)}
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            activeAccount === account.id
              ? "bg-cy-accent/20 text-cy-accent"
              : "text-cy-muted hover:text-cy-text"
          )}
        >
          {account.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create file-browser.tsx**

```typescript
"use client";

import { useEffect, useCallback } from "react";
import { useDriveStore } from "@/stores/drive-store";

function formatSize(bytes: number): string {
  if (bytes === 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function FileBrowser() {
  const {
    activeAccount,
    currentPath,
    files,
    selectedFile,
    isLoading,
    searchQuery,
    searchResults,
    error,
    setCurrentPath,
    setFiles,
    setSelectedFile,
    setIsLoading,
    setSearchQuery,
    setSearchResults,
    setError,
  } = useDriveStore();

  const fetchFiles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/drive/list?accountId=${activeAccount}&path=${encodeURIComponent(currentPath)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFiles(data.files);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load files");
    } finally {
      setIsLoading(false);
    }
  }, [activeAccount, currentPath, setFiles, setIsLoading, setError]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/drive/search?accountId=${activeAccount}&query=${encodeURIComponent(searchQuery)}&path=${encodeURIComponent(currentPath)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSearchResults(data.files);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setIsLoading(false);
    }
  };

  const navigateTo = (filePath: string) => {
    setCurrentPath(filePath);
    setSearchResults(null);
    setSearchQuery("");
  };

  const goUp = () => {
    if (currentPath === ".") return;
    const parts = currentPath.split("/");
    parts.pop();
    setCurrentPath(parts.length ? parts.join("/") : ".");
  };

  const breadcrumbs = currentPath === "." ? ["root"] : ["root", ...currentPath.split("/")];
  const displayFiles = searchResults ?? files;

  return (
    <div className="flex flex-col gap-2">
      {/* Search */}
      <div className="flex gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="搜尋檔案..."
          className="flex-1 rounded-md border border-cy-input bg-cy-input/30 px-3 py-1.5 text-sm text-cy-text placeholder:text-cy-muted focus:outline-none focus:ring-1 focus:ring-cy-accent"
        />
        <button
          onClick={handleSearch}
          className="rounded-md bg-cy-accent/20 px-3 py-1.5 text-xs font-medium text-cy-accent hover:bg-cy-accent/30"
        >
          搜尋
        </button>
        {searchResults && (
          <button
            onClick={() => { setSearchResults(null); setSearchQuery(""); }}
            className="rounded-md px-3 py-1.5 text-xs text-cy-muted hover:text-cy-text"
          >
            清除
          </button>
        )}
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 text-xs text-cy-muted">
        {breadcrumbs.map((part, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span>/</span>}
            <button
              onClick={() => {
                if (i === 0) navigateTo(".");
                else navigateTo(breadcrumbs.slice(1, i + 1).join("/"));
              }}
              className="hover:text-cy-accent"
            >
              {part}
            </button>
          </span>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* File list */}
      <div className="flex flex-col rounded-md border border-cy-input/30">
        {/* Go up */}
        {currentPath !== "." && !searchResults && (
          <button
            onClick={goUp}
            className="flex items-center gap-2 border-b border-cy-input/20 px-3 py-2 text-sm text-cy-muted hover:bg-cy-input/20"
          >
            <span>📁</span>
            <span>..</span>
          </button>
        )}

        {isLoading ? (
          <div className="px-3 py-4 text-center text-sm text-cy-muted">
            載入中...
          </div>
        ) : displayFiles.length === 0 ? (
          <div className="px-3 py-4 text-center text-sm text-cy-muted">
            {searchResults ? "找不到符合的檔案" : "空資料夾"}
          </div>
        ) : (
          displayFiles.map((file) => (
            <button
              key={file.path}
              onClick={() => {
                if (file.isDirectory) {
                  navigateTo(file.path);
                } else {
                  setSelectedFile(file);
                }
              }}
              className={`flex items-center gap-2 border-b border-cy-input/10 px-3 py-2 text-left text-sm transition-colors hover:bg-cy-input/20 ${
                selectedFile?.path === file.path ? "bg-cy-accent/10" : ""
              }`}
            >
              <span>{file.isDirectory ? "📁" : "📄"}</span>
              <span className="flex-1 truncate text-cy-text">{file.name}</span>
              <span className="text-xs text-cy-muted">{formatSize(file.size)}</span>
              <span className="text-xs text-cy-muted">{formatDate(file.modifiedAt)}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/drive/account-switcher.tsx dashboard/src/components/drive/file-browser.tsx
git commit -m "feat(dashboard): add AccountSwitcher and FileBrowser components"
```

---

## Task 12: Drive Panel UI — FilePreview + DrivePanel Container

**Files:**
- Create: `dashboard/src/components/drive/file-preview.tsx`
- Create: `dashboard/src/components/drive/drive-panel.tsx`

- [ ] **Step 1: Create file-preview.tsx**

```typescript
"use client";

import { useEffect, useState } from "react";
import { useDriveStore } from "@/stores/drive-store";

export function FilePreview() {
  const { activeAccount, selectedFile } = useDriveStore();
  const [content, setContent] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("");
  const [encoding, setEncoding] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!selectedFile) {
      setContent(null);
      return;
    }

    setIsLoading(true);
    fetch(
      `/api/drive/read?accountId=${activeAccount}&path=${encodeURIComponent(selectedFile.path)}`
    )
      .then((res) => res.json())
      .then((data) => {
        setContent(data.content ?? null);
        setMimeType(data.mimeType ?? "");
        setEncoding(data.encoding ?? "");
      })
      .catch(() => setContent(null))
      .finally(() => setIsLoading(false));
  }, [activeAccount, selectedFile]);

  if (!selectedFile) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-cy-muted">
        選擇一個檔案來預覽
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="truncate text-sm font-medium text-cy-text">
          {selectedFile.name}
        </h3>
        <span className="text-xs text-cy-muted">{selectedFile.mimeType}</span>
      </div>

      <div className="flex-1 overflow-auto rounded-md border border-cy-input/30 bg-cy-card p-3">
        {isLoading ? (
          <div className="text-sm text-cy-muted">載入中...</div>
        ) : content === null ? (
          <div className="text-sm text-cy-muted">無法預覽此檔案類型</div>
        ) : encoding === "base64" && mimeType.startsWith("image/") ? (
          <img
            src={`data:${mimeType};base64,${content}`}
            alt={selectedFile.name}
            className="max-w-full rounded"
          />
        ) : (
          <pre className="whitespace-pre-wrap text-xs text-cy-text">
            {content.length > 50000 ? content.slice(0, 50000) + "\n\n... (truncated)" : content}
          </pre>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Replace stub drive-panel.tsx with full implementation**

```typescript
"use client";

import { AccountSwitcher } from "./account-switcher";
import { FileBrowser } from "./file-browser";
import { FilePreview } from "./file-preview";
import { useDriveStore } from "@/stores/drive-store";

export function DrivePanel() {
  const { selectedFile } = useDriveStore();

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-cy-text">Drive</h1>
        <AccountSwitcher />
      </div>

      <div className="flex min-h-0 flex-1 gap-3">
        {/* File browser */}
        <div className={`min-h-0 overflow-auto ${selectedFile ? "w-1/2" : "w-full"}`}>
          <FileBrowser />
        </div>

        {/* Preview pane */}
        {selectedFile && (
          <div className="w-1/2 min-h-0 overflow-auto">
            <FilePreview />
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify the full app compiles and runs**

```bash
cd dashboard && npx next build 2>&1 | tail -30
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/drive/file-preview.tsx dashboard/src/components/drive/drive-panel.tsx
git commit -m "feat(dashboard): add DrivePanel with FilePreview — M3.5 Drive UI complete"
```

---

## Task 13: Manual Integration Test

- [ ] **Step 1: Start dev server and test all pages**

```bash
cd dashboard && npm run dev
```

Test in browser:
1. Overview page loads normally
2. Sidebar shows: Overview, Gmail, Drive, Documents, Search (no Calendar external link)
3. Gmail/Documents/Search show placeholder text
4. External links section shows only "Tasks (Notion)"
5. Drive page shows account switcher (個人/學校)
6. Switching accounts loads correct files
7. Clicking folders navigates into them
8. Breadcrumbs work for navigation
9. Clicking a file shows preview in right pane
10. Search returns results

- [ ] **Step 2: Test path traversal protection**

```bash
curl "http://localhost:3000/api/drive/list?accountId=personal&path=../../etc"
```

Expected: `{ "error": "Forbidden path" }` with status 403.

- [ ] **Step 3: Final commit (if any fixes needed)**

---

## Task 14: Clean up CLAUDE.md handoff prompt

- [ ] **Step 1: Remove the `🔜 Next Session` block from CLAUDE.md**

Since this task has been started, remove the handoff block from `/Users/username/CycloneOpenClaw/CLAUDE.md` to prevent it from showing in future sessions.
