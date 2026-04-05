# 會議記錄工作站 UI Phase 1 — 教育工作站 + 特推會 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the education workstation entry page and the complete SPC (特推會) meeting panel with shared components, committee management, AI drafting, and .docx/.md generation.

**Architecture:** Education workstation renders a sub-module card grid. Clicking "特推會會議" opens an independent panel with a 4-step flow (basic info → decisions/report → proposals → download). Shared meeting components (HeaderForm, SectionEditor, DownloadPanel) are config-driven so IEP can reuse them in Phase 2. API routes shell out to existing Python scripts via `child_process.spawn`.

**Tech Stack:** Next.js App Router, React 19, Zustand, Tailwind CSS, python-docx (existing scripts), child_process.spawn

**Spec:** `docs/superpowers/specs/2026-04-05-meeting-workstation-ui-design.md`

**Scope:** This plan covers the education workstation shell + SPC meeting panel only. IEP meeting panel is Phase 2 (separate plan).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/config/education-modules.ts` | Sub-module definitions (id, name, icon, status) |
| `src/components/skills/workstations/education/education-workstation.tsx` | Entry page: sub-module card grid + routing to panels |
| `src/components/skills/workstations/education/shared/meeting-header-form.tsx` | Config-driven Header form (FieldDef[]) |
| `src/components/skills/workstations/education/shared/meeting-section-editor.tsx` | Labeled textarea for content sections |
| `src/components/skills/workstations/education/shared/meeting-preview.tsx` | Read-only preview combining header + sections |
| `src/components/skills/workstations/education/shared/download-panel.tsx` | Download .docx / .md buttons with status |
| `src/components/skills/workstations/education/shared/student-picker.tsx` | Dynamic student table (manual input, future: Obsidian integration) |
| `src/components/skills/workstations/education/shared/history-reference.tsx` | Collapsible historical meeting reference panel |
| `src/components/skills/workstations/education/spc-meeting/spc-meeting-panel.tsx` | Main SPC panel: 4-step flow orchestration |
| `src/components/skills/workstations/education/spc-meeting/proposal-form.tsx` | Single proposal: type selector, students, doc ref, AI draft result |
| `src/components/skills/workstations/education/spc-meeting/business-report-editor.tsx` | Business report textarea |
| `src/components/skills/workstations/education/spc-meeting/previous-decisions.tsx` | Auto-loaded previous decisions with edit |
| `src/components/skills/workstations/education/spc-meeting/committee-manager.tsx` | Committee roster modal: view/edit/copy per academic year |
| `src/app/api/education/committee/route.ts` | GET/PUT committee roster (.md in Obsidian) |
| `src/app/api/education/committee/copy/route.ts` | POST copy roster from previous year |
| `src/app/api/education/spc-meeting/draft/route.ts` | POST AI draft proposal description |
| `src/app/api/education/spc-meeting/history/route.ts` | GET historical similar meetings |
| `src/app/api/education/spc-meeting/generate/route.ts` | POST generate .docx + .md |
| `src/lib/education/obsidian-paths.ts` | Centralized Obsidian path constants and helpers |
| `src/lib/education/committee-parser.ts` | Parse/serialize committee .md (frontmatter + markdown table) |
| `src/lib/education/spc-history.ts` | Read historical SPC meetings from Obsidian .md files |
| Modify: `src/components/skills/skills-panel.tsx` | Add education workstation routing |
| Modify: `src/config/skills-config.ts` | Update education workstation description |

---

### Task 1: Education workstation entry page + routing

Wire up the education workstation so clicking the 🎓 card opens a sub-module selection grid instead of the placeholder.

**Files:**
- Create: `src/config/education-modules.ts`
- Create: `src/components/skills/workstations/education/education-workstation.tsx`
- Modify: `src/components/skills/skills-panel.tsx:1-62`
- Modify: `src/config/skills-config.ts:46-53`

- [ ] **Step 1: Create education module config**

```typescript
// src/config/education-modules.ts
export interface EducationModule {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: "active" | "coming-soon";
}

export const EDUCATION_MODULES: EducationModule[] = [
  {
    id: "iep-meeting",
    name: "IEP 會議記錄",
    description: "錄音→逐字稿→AI 分析→會議記錄",
    icon: "📋",
    status: "coming-soon",
  },
  {
    id: "spc-meeting",
    name: "特推會會議記錄",
    description: "填表→AI 草擬→會議記錄",
    icon: "📋",
    status: "active",
  },
  {
    id: "iep-plan",
    name: "IEP 服務計劃",
    description: "學生資料→AI 輔助→服務計劃",
    icon: "📝",
    status: "coming-soon",
  },
  {
    id: "curriculum",
    name: "課程計劃",
    description: "分組→課綱→AI 產出→課程計劃",
    icon: "📚",
    status: "coming-soon",
  },
];
```

- [ ] **Step 2: Create education workstation entry page**

```typescript
// src/components/skills/workstations/education/education-workstation.tsx
"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { EDUCATION_MODULES, type EducationModule } from "@/config/education-modules";
import { SpcMeetingPanel } from "./spc-meeting/spc-meeting-panel";

export function EducationWorkstation() {
  const { setActiveWorkstation } = useAppStore();
  const [activeModule, setActiveModule] = useState<string | null>(null);

  // Sub-module panel view
  if (activeModule === "spc-meeting") {
    return <SpcMeetingPanel onBack={() => setActiveModule(null)} />;
  }
  // Future: if (activeModule === "iep-meeting") return <IepMeetingPanel ... />;

  // Module selection grid
  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 5.5rem)" }}>
      <div className="flex items-center gap-3 border-b border-cy-border pb-3">
        <button
          onClick={() => setActiveWorkstation(null)}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-cy-muted hover:bg-cy-input/50 hover:text-cy-text transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Skills
        </button>
        <span className="text-lg">🎓</span>
        <h1 className="text-lg font-bold text-cy-text">教育工作站</h1>
      </div>

      <div className="flex-1 overflow-y-auto py-6">
        <div className="mx-auto max-w-2xl">
          <div className="grid grid-cols-2 gap-4">
            {EDUCATION_MODULES.map((mod) => (
              <ModuleCard
                key={mod.id}
                module={mod}
                onClick={() => mod.status === "active" && setActiveModule(mod.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ModuleCard({ module, onClick }: { module: EducationModule; onClick: () => void }) {
  const isActive = module.status === "active";

  return (
    <button
      onClick={onClick}
      disabled={!isActive}
      className={`rounded-lg border p-4 text-left transition-colors ${
        isActive
          ? "border-cy-border bg-cy-card hover:border-cy-accent hover:bg-cy-card/80 cursor-pointer"
          : "border-cy-border/50 bg-cy-card/30 opacity-50 cursor-default"
      }`}
    >
      <span className="text-2xl">{module.icon}</span>
      <h3 className="mt-2 text-sm font-bold text-cy-text">{module.name}</h3>
      <p className="mt-1 text-xs text-cy-muted">{module.description}</p>
      {!isActive && (
        <p className="mt-2 text-[10px] text-cy-muted">即將推出</p>
      )}
    </button>
  );
}
```

- [ ] **Step 3: Wire up routing in skills-panel.tsx**

In `src/components/skills/skills-panel.tsx`, add the import and routing case:

Add import at top:
```typescript
import { EducationWorkstation } from "./workstations/education/education-workstation";
```

Add before the `return <WorkstationPlaceholder skill={skill} />;` line (after the transcribe block):
```typescript
    if (activeWorkstation === "education") {
      return <EducationWorkstation />;
    }
```

- [ ] **Step 4: Update skills-config description**

In `src/config/skills-config.ts`, update the education entry description to reflect meeting record capability:

```typescript
  {
    id: "education",
    name: "教育工作站",
    description: "會議記錄・IEP・課程計畫・教案・特推會",
    icon: "🎓",
    type: "workstation",
    tags: ["IEP", "特推會", "會議記錄", "課程計畫", "教案", "特教"],
  },
```

- [ ] **Step 5: Create stub SpcMeetingPanel for compilation**

Create a minimal stub so the education workstation compiles:

```typescript
// src/components/skills/workstations/education/spc-meeting/spc-meeting-panel.tsx
"use client";

import { ArrowLeft } from "lucide-react";

interface SpcMeetingPanelProps {
  onBack: () => void;
}

export function SpcMeetingPanel({ onBack }: SpcMeetingPanelProps) {
  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 5.5rem)" }}>
      <div className="flex items-center gap-3 border-b border-cy-border pb-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-cy-muted hover:bg-cy-input/50 hover:text-cy-text transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          教育工作站
        </button>
        <span className="text-lg">📋</span>
        <h1 className="text-lg font-bold text-cy-text">特推會會議記錄</h1>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-cy-muted">特推會面板建構中...</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verify build**

Run: `cd /Users/kangyunsheng/CycloneOS && npm run build`
Expected: Build succeeds. Education workstation card opens sub-module grid, SPC card navigates to stub panel.

- [ ] **Step 7: Commit**

```bash
git add src/config/education-modules.ts src/config/skills-config.ts \
  src/components/skills/skills-panel.tsx \
  src/components/skills/workstations/education/education-workstation.tsx \
  src/components/skills/workstations/education/spc-meeting/spc-meeting-panel.tsx
git commit -m "feat(education): education workstation entry page with sub-module routing"
```

---

### Task 2: Shared meeting components — HeaderForm + SectionEditor

Build the two core config-driven editing components used by both SPC and (future) IEP panels.

**Files:**
- Create: `src/components/skills/workstations/education/shared/meeting-header-form.tsx`
- Create: `src/components/skills/workstations/education/shared/meeting-section-editor.tsx`

- [ ] **Step 1: Create MeetingHeaderForm**

```typescript
// src/components/skills/workstations/education/shared/meeting-header-form.tsx
"use client";

export interface FieldDef {
  key: string;
  label: string;
  type: "text" | "date" | "time" | "select" | "number";
  defaultValue?: string;
  options?: { label: string; value: string }[];
  readOnly?: boolean;
  placeholder?: string;
}

interface MeetingHeaderFormProps {
  fields: FieldDef[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

export function MeetingHeaderForm({ fields, values, onChange }: MeetingHeaderFormProps) {
  return (
    <div className="space-y-3">
      {fields.map((field) => (
        <div key={field.key} className="flex items-center gap-3">
          <label className="w-24 shrink-0 text-right text-xs text-cy-muted">
            {field.label}
          </label>
          {field.type === "select" ? (
            <select
              value={values[field.key] ?? field.defaultValue ?? ""}
              onChange={(e) => onChange(field.key, e.target.value)}
              disabled={field.readOnly}
              className="flex-1 rounded-md border border-cy-border bg-cy-input px-3 py-1.5 text-sm text-cy-text focus:border-cy-accent focus:outline-none disabled:opacity-50"
            >
              <option value="">請選擇</option>
              {field.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ) : (
            <input
              type={field.type === "number" ? "number" : "text"}
              value={values[field.key] ?? field.defaultValue ?? ""}
              onChange={(e) => onChange(field.key, e.target.value)}
              readOnly={field.readOnly}
              placeholder={field.placeholder}
              className="flex-1 rounded-md border border-cy-border bg-cy-input px-3 py-1.5 text-sm text-cy-text focus:border-cy-accent focus:outline-none read-only:opacity-50"
            />
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create MeetingSectionEditor**

```typescript
// src/components/skills/workstations/education/shared/meeting-section-editor.tsx
"use client";

export interface SectionDef {
  key: string;
  label: string;
  placeholder?: string;
  minRows?: number;
}

interface MeetingSectionEditorProps {
  sections: SectionDef[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

export function MeetingSectionEditor({ sections, values, onChange }: MeetingSectionEditorProps) {
  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <div key={section.key}>
          <label className="mb-1.5 block text-xs font-medium text-cy-muted">
            {section.label}
          </label>
          <textarea
            value={values[section.key] ?? ""}
            onChange={(e) => onChange(section.key, e.target.value)}
            placeholder={section.placeholder}
            rows={section.minRows ?? 4}
            className="w-full rounded-md border border-cy-border bg-cy-input px-3 py-2 text-sm text-cy-text focus:border-cy-accent focus:outline-none resize-y"
          />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/kangyunsheng/CycloneOS && npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/skills/workstations/education/shared/meeting-header-form.tsx \
  src/components/skills/workstations/education/shared/meeting-section-editor.tsx
git commit -m "feat(education): shared MeetingHeaderForm + MeetingSectionEditor components"
```

---

### Task 3: Shared meeting components — StudentPicker + DownloadPanel + HistoryReference

**Files:**
- Create: `src/components/skills/workstations/education/shared/student-picker.tsx`
- Create: `src/components/skills/workstations/education/shared/download-panel.tsx`
- Create: `src/components/skills/workstations/education/shared/history-reference.tsx`

- [ ] **Step 1: Create StudentPicker**

```typescript
// src/components/skills/workstations/education/shared/student-picker.tsx
"use client";

import { Plus, X } from "lucide-react";

export interface StudentInfo {
  name: string;
  className: string;
  disability: string;
  detail?: string;
}

interface StudentPickerProps {
  value: StudentInfo[];
  onChange: (students: StudentInfo[]) => void;
}

const EMPTY_STUDENT: StudentInfo = { name: "", className: "", disability: "", detail: "" };

export function StudentPicker({ value, onChange }: StudentPickerProps) {
  const addStudent = () => onChange([...value, { ...EMPTY_STUDENT }]);

  const removeStudent = (index: number) => onChange(value.filter((_, i) => i !== index));

  const updateStudent = (index: number, field: keyof StudentInfo, val: string) => {
    const updated = value.map((s, i) => (i === index ? { ...s, [field]: val } : s));
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_80px_100px_1fr_32px] gap-1.5 text-[10px] text-cy-muted font-medium">
        <span>姓名</span>
        <span>班級</span>
        <span>障別程度</span>
        <span>備註</span>
        <span />
      </div>
      {value.map((student, i) => (
        <div key={i} className="grid grid-cols-[1fr_80px_100px_1fr_32px] gap-1.5">
          <input
            value={student.name}
            onChange={(e) => updateStudent(i, "name", e.target.value)}
            placeholder="姓名"
            className="rounded border border-cy-border bg-cy-input px-2 py-1 text-xs text-cy-text focus:border-cy-accent focus:outline-none"
          />
          <input
            value={student.className}
            onChange={(e) => updateStudent(i, "className", e.target.value)}
            placeholder="班級"
            className="rounded border border-cy-border bg-cy-input px-2 py-1 text-xs text-cy-text focus:border-cy-accent focus:outline-none"
          />
          <input
            value={student.disability}
            onChange={(e) => updateStudent(i, "disability", e.target.value)}
            placeholder="障別"
            className="rounded border border-cy-border bg-cy-input px-2 py-1 text-xs text-cy-text focus:border-cy-accent focus:outline-none"
          />
          <input
            value={student.detail ?? ""}
            onChange={(e) => updateStudent(i, "detail", e.target.value)}
            placeholder="備註"
            className="rounded border border-cy-border bg-cy-input px-2 py-1 text-xs text-cy-text focus:border-cy-accent focus:outline-none"
          />
          <button
            onClick={() => removeStudent(i)}
            className="flex items-center justify-center rounded text-cy-muted hover:text-cy-error transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button
        onClick={addStudent}
        className="flex items-center gap-1 text-xs text-cy-accent hover:text-cy-accent/80 transition-colors"
      >
        <Plus className="h-3 w-3" />
        新增學生
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create DownloadPanel**

```typescript
// src/components/skills/workstations/education/shared/download-panel.tsx
"use client";

import { Download, FileText, Check, Loader2 } from "lucide-react";

interface DownloadResult {
  docxUrl?: string;
  docxFilename?: string;
  mdPath?: string;
  mocUpdated?: boolean;
}

interface DownloadPanelProps {
  result: DownloadResult | null;
  loading?: boolean;
  onGenerate: () => void;
  generateLabel?: string;
}

export function DownloadPanel({ result, loading, onGenerate, generateLabel }: DownloadPanelProps) {
  if (!result) {
    return (
      <button
        onClick={onGenerate}
        disabled={loading}
        className="flex items-center gap-2 rounded-lg bg-cy-accent px-4 py-2 text-sm font-medium text-white hover:bg-cy-accent/90 disabled:opacity-50 transition-colors"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
        {loading ? "生成中..." : (generateLabel ?? "生成文件")}
      </button>
    );
  }

  return (
    <div className="space-y-2">
      {result.docxUrl && (
        <a
          href={result.docxUrl}
          download={result.docxFilename}
          className="flex items-center gap-2 rounded-lg border border-cy-accent bg-cy-accent/10 px-4 py-2 text-sm text-cy-accent hover:bg-cy-accent/20 transition-colors"
        >
          <Download className="h-4 w-4" />
          下載 .docx
          {result.docxFilename && (
            <span className="ml-auto text-xs text-cy-muted">{result.docxFilename}</span>
          )}
        </a>
      )}
      {result.mdPath && (
        <div className="flex items-center gap-2 text-xs text-cy-muted">
          <Check className="h-3.5 w-3.5 text-green-500" />
          .md 已存：{result.mdPath}
        </div>
      )}
      {result.mocUpdated && (
        <div className="flex items-center gap-2 text-xs text-cy-muted">
          <Check className="h-3.5 w-3.5 text-green-500" />
          MOC 已更新
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create HistoryReference**

```typescript
// src/components/skills/workstations/education/shared/history-reference.tsx
"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, FileText } from "lucide-react";

export interface HistoryRecord {
  filename: string;
  date: string;
  topic: string;
  excerpt: string;
}

interface HistoryReferenceProps {
  records: HistoryRecord[];
  loading?: boolean;
  label?: string;
}

export function HistoryReference({ records, loading, label }: HistoryReferenceProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  if (records.length === 0 && !loading) return null;

  const displayRecords = showAll ? records : records.slice(0, 3);
  const hiddenCount = records.length - 3;

  return (
    <div className="rounded-lg border border-cy-border">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-cy-muted hover:text-cy-text transition-colors"
      >
        {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        {label ?? `查看歷史參考（找到 ${records.length} 份同類）`}
        {loading && <span className="text-[10px]">載入中...</span>}
      </button>

      {isOpen && (
        <div className="border-t border-cy-border px-3 py-2 space-y-3">
          {displayRecords.map((record) => (
            <div key={record.filename} className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-cy-text">
                <FileText className="h-3 w-3 text-cy-muted" />
                {record.filename}
                <span className="text-cy-muted">（{record.date}）</span>
              </div>
              <p className="pl-4.5 text-xs text-cy-muted line-clamp-2">{record.excerpt}</p>
            </div>
          ))}
          {!showAll && hiddenCount > 0 && (
            <button
              onClick={() => setShowAll(true)}
              className="text-xs text-cy-accent hover:text-cy-accent/80"
            >
              顯示更多 ({hiddenCount})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `cd /Users/kangyunsheng/CycloneOS && npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/skills/workstations/education/shared/student-picker.tsx \
  src/components/skills/workstations/education/shared/download-panel.tsx \
  src/components/skills/workstations/education/shared/history-reference.tsx
git commit -m "feat(education): shared StudentPicker, DownloadPanel, HistoryReference components"
```

---

### Task 4: Obsidian path helpers + committee parser

Build the utilities that API routes need to read/write Obsidian files.

**Files:**
- Create: `src/lib/education/obsidian-paths.ts`
- Create: `src/lib/education/committee-parser.ts`

- [ ] **Step 1: Create Obsidian path constants**

```typescript
// src/lib/education/obsidian-paths.ts
import { homedir } from "os";
import { join } from "path";

const OBSIDIAN_ROOT = join(homedir(), "Obsidian-Cyclone");
const SPECIAL_ED = join(OBSIDIAN_ROOT, "02-特教業務");

export const OBSIDIAN_PATHS = {
  root: OBSIDIAN_ROOT,
  specialEd: SPECIAL_ED,
  spcMeeting: join(SPECIAL_ED, "特推會"),
  spcCommittee: join(SPECIAL_ED, "特推會", "委員名冊"),
  spcMoc: join(SPECIAL_ED, "特推會", "moc-特推會.md"),
  iep: join(SPECIAL_ED, "IEP"),
  iepTranscripts: join(SPECIAL_ED, "IEP", "逐字稿"),
  studentData: join(SPECIAL_ED, "學生資料"),
} as const;

/** Build committee roster filename for a given academic year. */
export function committeeFilename(year: number): string {
  return `${year}-特推會委員名冊.md`;
}

/** Build committee roster full path. */
export function committeePath(year: number): string {
  return join(OBSIDIAN_PATHS.spcCommittee, committeeFilename(year));
}

/** Build SPC meeting filename. */
export function spcMeetingFilename(year: number, num: number, topic: string): string {
  const nn = String(num).padStart(2, "0");
  return `${year}-特推會-${nn}-${topic}.md`;
}

/** Build SPC meeting full path. */
export function spcMeetingPath(year: number, num: number, topic: string): string {
  return join(OBSIDIAN_PATHS.spcMeeting, spcMeetingFilename(year, num, topic));
}
```

- [ ] **Step 2: Create committee parser**

```typescript
// src/lib/education/committee-parser.ts
import { readFile, writeFile, mkdir } from "fs/promises";
import { dirname } from "path";
import { committeePath } from "./obsidian-paths";

export interface CommitteeMember {
  order: number;
  title: string;
  name: string;
  role: string;
  note: string;
}

interface CommitteeRoster {
  year: number;
  members: CommitteeMember[];
}

/** Parse a committee .md file into structured data. */
export async function parseCommitteeFile(year: number): Promise<CommitteeRoster> {
  const path = committeePath(year);
  let content: string;
  try {
    content = await readFile(path, "utf-8");
  } catch {
    return { year, members: [] };
  }

  const members: CommitteeMember[] = [];
  const lines = content.split("\n");
  let inTable = false;
  let headerPassed = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) {
      if (inTable) break;
      continue;
    }

    inTable = true;

    // Skip header row
    if (!headerPassed) {
      headerPassed = true;
      continue;
    }

    // Skip separator row (|---|---|...)
    if (trimmed.match(/^\|[\s-|]+\|$/)) continue;

    const cells = trimmed
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c !== "");

    if (cells.length >= 4) {
      members.push({
        order: parseInt(cells[0], 10) || members.length + 1,
        title: cells[1],
        name: cells[2],
        role: cells[3],
        note: cells[4] ?? "",
      });
    }
  }

  return { year, members };
}

/** Serialize committee roster to .md and write to Obsidian. */
export async function writeCommitteeFile(roster: CommitteeRoster): Promise<string> {
  const path = committeePath(roster.year);
  await mkdir(dirname(path), { recursive: true });

  const today = new Date();
  const rocYear = today.getFullYear() - 1911;
  const updated = `${rocYear}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const lines = [
    "---",
    "type: 特推會委員名冊",
    `academic_year: ${roster.year}`,
    `updated: "${updated}"`,
    "tags: [特推會, 委員名冊]",
    "---",
    "",
    "| 序號 | 職稱 | 姓名 | 身份 | 備註 |",
    "|------|------|------|------|------|",
  ];

  for (const m of roster.members) {
    lines.push(`| ${m.order} | ${m.title} | ${m.name} | ${m.role} | ${m.note} |`);
  }

  lines.push("");

  const content = lines.join("\n");
  await writeFile(path, content, "utf-8");
  return path;
}
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/kangyunsheng/CycloneOS && npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/lib/education/obsidian-paths.ts src/lib/education/committee-parser.ts
git commit -m "feat(education): Obsidian path helpers + committee .md parser"
```

---

### Task 5: Committee API routes

**Files:**
- Create: `src/app/api/education/committee/route.ts`
- Create: `src/app/api/education/committee/copy/route.ts`

- [ ] **Step 1: Create committee GET/PUT route**

```typescript
// src/app/api/education/committee/route.ts
import { parseCommitteeFile, writeCommitteeFile } from "@/lib/education/committee-parser";
import type { CommitteeMember } from "@/lib/education/committee-parser";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const yearStr = url.searchParams.get("year");
  if (!yearStr) {
    return Response.json({ error: "Missing year parameter" }, { status: 400 });
  }

  const year = parseInt(yearStr, 10);
  if (isNaN(year)) {
    return Response.json({ error: "Invalid year" }, { status: 400 });
  }

  try {
    const roster = await parseCommitteeFile(year);
    return Response.json(roster);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      year: number;
      members: CommitteeMember[];
    };

    if (!body.year || !Array.isArray(body.members)) {
      return Response.json({ error: "Missing year or members" }, { status: 400 });
    }

    const path = await writeCommitteeFile({ year: body.year, members: body.members });
    return Response.json({ saved: true, path });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create committee copy route**

```typescript
// src/app/api/education/committee/copy/route.ts
import { parseCommitteeFile, writeCommitteeFile } from "@/lib/education/committee-parser";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { fromYear, toYear } = (await request.json()) as {
      fromYear: number;
      toYear: number;
    };

    if (!fromYear || !toYear) {
      return Response.json({ error: "Missing fromYear or toYear" }, { status: 400 });
    }

    const source = await parseCommitteeFile(fromYear);
    if (source.members.length === 0) {
      return Response.json({ error: `No roster found for year ${fromYear}` }, { status: 404 });
    }

    const path = await writeCommitteeFile({ year: toYear, members: source.members });
    return Response.json({ saved: true, members: source.members, path });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/kangyunsheng/CycloneOS && npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/education/committee/route.ts \
  src/app/api/education/committee/copy/route.ts
git commit -m "feat(education): committee roster API routes (GET/PUT/copy)"
```

---

### Task 6: CommitteeManager component

**Files:**
- Create: `src/components/skills/workstations/education/spc-meeting/committee-manager.tsx`

- [ ] **Step 1: Create CommitteeManager modal**

```typescript
// src/components/skills/workstations/education/spc-meeting/committee-manager.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { X, Plus, Copy, Save, Loader2 } from "lucide-react";
import type { CommitteeMember } from "@/lib/education/committee-parser";

interface CommitteeManagerProps {
  year: number;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (members: CommitteeMember[]) => void;
}

const EMPTY_MEMBER: CommitteeMember = { order: 0, title: "", name: "", role: "委員", note: "" };

export function CommitteeManager({ year, isOpen, onClose, onSaved }: CommitteeManagerProps) {
  const [members, setMembers] = useState<CommitteeMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchRoster = useCallback(async (y: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/education/committee?year=${y}`);
      const data = await res.json();
      if (data.members) setMembers(data.members);
    } catch {
      // No roster found — start empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) fetchRoster(year);
  }, [isOpen, year, fetchRoster]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const numbered = members.map((m, i) => ({ ...m, order: i + 1 }));
      const res = await fetch("/api/education/committee", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, members: numbered }),
      });
      const data = await res.json();
      if (data.saved) {
        onSaved(numbered);
        onClose();
      }
    } catch (err) {
      console.error("Save committee failed:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyFromPrevious = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/education/committee/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromYear: year - 1, toYear: year }),
      });
      const data = await res.json();
      if (data.members) {
        setMembers(data.members);
      }
    } catch (err) {
      console.error("Copy committee failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const addMember = () => {
    setMembers([...members, { ...EMPTY_MEMBER, order: members.length + 1 }]);
  };

  const removeMember = (index: number) => {
    setMembers(members.filter((_, i) => i !== index));
  };

  const updateMember = (index: number, field: keyof CommitteeMember, value: string | number) => {
    setMembers(members.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-2xl rounded-xl border border-cy-border bg-cy-bg p-6 shadow-xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-cy-text">委員名冊管理 — {year} 學年度</h2>
          <button onClick={onClose} className="text-cy-muted hover:text-cy-text">
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-cy-muted" />
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="max-h-80 overflow-y-auto">
              <div className="grid grid-cols-[40px_1fr_80px_80px_1fr_32px] gap-1.5 text-[10px] text-cy-muted font-medium mb-1.5">
                <span>#</span>
                <span>職稱</span>
                <span>姓名</span>
                <span>身份</span>
                <span>備註</span>
                <span />
              </div>
              {members.map((member, i) => (
                <div key={i} className="grid grid-cols-[40px_1fr_80px_80px_1fr_32px] gap-1.5 mb-1">
                  <span className="flex items-center text-xs text-cy-muted">{i + 1}</span>
                  <input
                    value={member.title}
                    onChange={(e) => updateMember(i, "title", e.target.value)}
                    className="rounded border border-cy-border bg-cy-input px-2 py-1 text-xs text-cy-text focus:border-cy-accent focus:outline-none"
                  />
                  <input
                    value={member.name}
                    onChange={(e) => updateMember(i, "name", e.target.value)}
                    className="rounded border border-cy-border bg-cy-input px-2 py-1 text-xs text-cy-text focus:border-cy-accent focus:outline-none"
                  />
                  <select
                    value={member.role}
                    onChange={(e) => updateMember(i, "role", e.target.value)}
                    className="rounded border border-cy-border bg-cy-input px-1 py-1 text-xs text-cy-text focus:border-cy-accent focus:outline-none"
                  >
                    <option value="主席">主席</option>
                    <option value="委員">委員</option>
                    <option value="委員/記錄">委員/記錄</option>
                    <option value="記錄">記錄</option>
                  </select>
                  <input
                    value={member.note}
                    onChange={(e) => updateMember(i, "note", e.target.value)}
                    className="rounded border border-cy-border bg-cy-input px-2 py-1 text-xs text-cy-text focus:border-cy-accent focus:outline-none"
                  />
                  <button
                    onClick={() => removeMember(i)}
                    className="flex items-center justify-center text-cy-muted hover:text-cy-error"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={addMember}
              className="mt-2 flex items-center gap-1 text-xs text-cy-accent hover:text-cy-accent/80"
            >
              <Plus className="h-3 w-3" />
              新增委員
            </button>

            {/* Actions */}
            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={handleCopyFromPrevious}
                className="flex items-center gap-1.5 rounded-md border border-cy-border px-3 py-1.5 text-xs text-cy-muted hover:text-cy-text hover:border-cy-accent transition-colors"
              >
                <Copy className="h-3.5 w-3.5" />
                從 {year - 1} 學年複製
              </button>
              <div className="flex-1" />
              <button
                onClick={onClose}
                className="rounded-md px-3 py-1.5 text-xs text-cy-muted hover:text-cy-text transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-md bg-cy-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-cy-accent/90 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                儲存
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/kangyunsheng/CycloneOS && npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/skills/workstations/education/spc-meeting/committee-manager.tsx
git commit -m "feat(education): CommitteeManager modal for roster management"
```

---

### Task 7: SPC meeting history + draft API routes

**Files:**
- Create: `src/lib/education/spc-history.ts`
- Create: `src/app/api/education/spc-meeting/history/route.ts`
- Create: `src/app/api/education/spc-meeting/draft/route.ts`

- [ ] **Step 1: Create SPC history reader**

```typescript
// src/lib/education/spc-history.ts
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { OBSIDIAN_PATHS } from "./obsidian-paths";

export interface SpcHistoryRecord {
  filename: string;
  date: string;
  topic: string;
  excerpt: string;
  academicYear: number;
  meetingNumber: number;
}

/** Read all SPC meeting .md files and filter by topic keyword. */
export async function fetchSimilarMeetings(
  topicKeyword: string,
  limit = 5
): Promise<SpcHistoryRecord[]> {
  const dir = OBSIDIAN_PATHS.spcMeeting;
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }

  const mdFiles = files
    .filter((f) => f.endsWith(".md") && !f.startsWith("moc-"))
    .sort()
    .reverse(); // newest first

  const records: SpcHistoryRecord[] = [];

  for (const file of mdFiles) {
    if (records.length >= limit) break;

    const content = await readFile(join(dir, file), "utf-8");
    const frontmatter = parseFrontmatter(content);

    // Match by topics array or filename
    const topics: string[] = frontmatter.topics ?? [];
    const matchesTopic =
      topics.some((t: string) => t.includes(topicKeyword)) ||
      file.includes(topicKeyword);

    if (!matchesTopic) continue;

    // Extract proposal description excerpt
    const excerpt = extractProposalExcerpt(content, topicKeyword);

    records.push({
      filename: file.replace(".md", ""),
      date: frontmatter.date ?? "",
      topic: topics.join("、") || file.replace(/^\d+-特推會-\d+-/, "").replace(".md", ""),
      excerpt,
      academicYear: frontmatter.academic_year ?? 0,
      meetingNumber: frontmatter.meeting_number ?? 0,
    });
  }

  return records;
}

/** Fetch previous meeting decisions for tracking section. */
export async function fetchPreviousDecisions(
  academicYear: number,
  meetingNumber: number
): Promise<string> {
  if (meetingNumber <= 1) return "";

  const dir = OBSIDIAN_PATHS.spcMeeting;
  const prevNum = String(meetingNumber - 1).padStart(2, "0");
  const prefix = `${academicYear}-特推會-${prevNum}-`;

  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return "";
  }

  const prevFile = files.find((f) => f.startsWith(prefix) && f.endsWith(".md"));
  if (!prevFile) return "";

  const content = await readFile(join(dir, prevFile), "utf-8");
  const frontmatter = parseFrontmatter(content);
  const decisions: string[] = frontmatter.decisions ?? [];

  return decisions.join("\n");
}

function parseFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const yaml = match[1];
  const result: Record<string, unknown> = {};

  for (const line of yaml.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value: string | number | string[] = line.slice(colonIdx + 1).trim();

    // Handle YAML arrays: [a, b, c]
    if (value.startsWith("[") && value.endsWith("]")) {
      result[key] = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""));
      continue;
    }

    // Handle quoted strings
    value = value.replace(/^["']|["']$/g, "");

    // Handle numbers
    const num = Number(value);
    result[key] = isNaN(num) || value === "" ? value : num;
  }

  return result;
}

function extractProposalExcerpt(content: string, keyword: string): string {
  // Look for 【說明】 or **說明：** sections near the keyword
  const lines = content.split("\n");
  let capturing = false;
  const excerptLines: string[] = [];

  for (const line of lines) {
    if (line.includes("說明") && (line.includes("【") || line.includes("**"))) {
      capturing = true;
      continue;
    }
    if (capturing) {
      if (line.startsWith("【") || line.startsWith("**決議") || line.trim() === "") {
        if (excerptLines.length > 0) break;
        continue;
      }
      excerptLines.push(line.trim());
      if (excerptLines.length >= 3) break;
    }
  }

  return excerptLines.join(" ").slice(0, 200);
}
```

- [ ] **Step 2: Create history API route**

```typescript
// src/app/api/education/spc-meeting/history/route.ts
import { fetchSimilarMeetings, fetchPreviousDecisions } from "@/lib/education/spc-history";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const limitStr = url.searchParams.get("limit");
  const yearStr = url.searchParams.get("year");
  const numStr = url.searchParams.get("meetingNumber");

  try {
    // If year + meetingNumber provided, also fetch previous decisions
    let previousDecisions = "";
    if (yearStr && numStr) {
      previousDecisions = await fetchPreviousDecisions(
        parseInt(yearStr, 10),
        parseInt(numStr, 10)
      );
    }

    // Fetch similar meetings if type provided
    let records: Awaited<ReturnType<typeof fetchSimilarMeetings>> = [];
    if (type) {
      records = await fetchSimilarMeetings(type, limitStr ? parseInt(limitStr, 10) : 5);
    }

    return Response.json({ records, previousDecisions });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create draft API route**

This route calls the Python `spc_meeting_core.py` `draft_proposal` function via CLI. Since the core module exposes a CLI interface, we'll add a thin `--draft` mode to it.

```typescript
// src/app/api/education/spc-meeting/draft/route.ts
import { spawn } from "child_process";
import { join } from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SCRIPT_PATH = join(process.cwd(), "scripts/education/spc_meeting_core.py");

interface DraftRequest {
  proposalType: string;
  students: { name: string; className: string; disability: string; detail?: string }[];
  refDoc: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DraftRequest;

    if (!body.proposalType) {
      return Response.json({ error: "Missing proposalType" }, { status: 400 });
    }

    // Build the input JSON for the Python script
    const input = JSON.stringify({
      action: "draft",
      proposal_type: body.proposalType,
      students: body.students,
      ref_doc: body.refDoc,
    });

    const result = await runPython(SCRIPT_PATH, ["--json"], input);
    const parsed = JSON.parse(result);

    return Response.json({ title: parsed.title, description: parsed.description });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

function runPython(script: string, args: string[], stdin: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("python3", [script, ...args], {
      stdio: ["pipe", "pipe", "pipe"],
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

- [ ] **Step 4: Verify build**

Run: `cd /Users/kangyunsheng/CycloneOS && npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/lib/education/spc-history.ts \
  src/app/api/education/spc-meeting/history/route.ts \
  src/app/api/education/spc-meeting/draft/route.ts
git commit -m "feat(education): SPC meeting history reader + draft/history API routes"
```

---

### Task 8: SPC meeting generate API route

**Files:**
- Create: `src/app/api/education/spc-meeting/generate/route.ts`

- [ ] **Step 1: Create generate route**

```typescript
// src/app/api/education/spc-meeting/generate/route.ts
import { spawn } from "child_process";
import { join } from "path";
import { readFile } from "fs/promises";
import { homedir } from "os";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SCRIPT_PATH = join(process.cwd(), "scripts/education/spc_meeting_core.py");

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.academicYear || !body.meetingNumber || !body.proposals?.length) {
      return Response.json({ error: "Missing required meeting data" }, { status: 400 });
    }

    const input = JSON.stringify({
      action: "generate",
      ...body,
    });

    const result = await runPython(SCRIPT_PATH, ["--json"], input);
    const parsed = JSON.parse(result);

    // If docx was generated, serve it as a downloadable file
    if (parsed.docx_path) {
      const docxBuffer = await readFile(parsed.docx_path);
      const filename = parsed.docx_path.split("/").pop() ?? "meeting.docx";

      // Also return metadata as headers
      return new Response(docxBuffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
          "X-Md-Path": parsed.md_path ?? "",
          "X-Moc-Updated": parsed.moc_updated ? "true" : "false",
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

- [ ] **Step 2: Verify build**

Run: `cd /Users/kangyunsheng/CycloneOS && npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/education/spc-meeting/generate/route.ts
git commit -m "feat(education): SPC meeting generate API route (.docx + .md)"
```

---

### Task 9: SPC meeting sub-components

Build the SPC-specific form components before wiring them into the main panel.

**Files:**
- Create: `src/components/skills/workstations/education/spc-meeting/proposal-form.tsx`
- Create: `src/components/skills/workstations/education/spc-meeting/previous-decisions.tsx`
- Create: `src/components/skills/workstations/education/spc-meeting/business-report-editor.tsx`

- [ ] **Step 1: Create ProposalForm**

```typescript
// src/components/skills/workstations/education/spc-meeting/proposal-form.tsx
"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Loader2, RefreshCw, Check } from "lucide-react";
import { StudentPicker, type StudentInfo } from "../shared/student-picker";
import { HistoryReference, type HistoryRecord } from "../shared/history-reference";

export const PROPOSAL_TYPES = [
  "交通補助",
  "專團申請",
  "助理員申請",
  "酌減學生數",
  "轉安置",
  "課程計畫審議",
  "其他",
] as const;

export interface ProposalData {
  type: string;
  title: string;
  description: string;
  decision: string;
  students: StudentInfo[];
  refDoc: string;
}

interface ProposalFormProps {
  index: number;
  data: ProposalData;
  onChange: (data: ProposalData) => void;
  onRemove: () => void;
  canRemove: boolean;
}

export function ProposalForm({ index, data, onChange, onRemove, canRemove }: ProposalFormProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [drafted, setDrafted] = useState(false);

  const update = (patch: Partial<ProposalData>) => onChange({ ...data, ...patch });

  const fetchHistory = async (type: string) => {
    if (!type || type === "其他") return;
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/education/spc-meeting/history?type=${encodeURIComponent(type)}&limit=5`);
      const result = await res.json();
      if (result.records) setHistoryRecords(result.records);
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleTypeChange = (type: string) => {
    update({ type });
    fetchHistory(type);
  };

  const handleDraft = async () => {
    setDrafting(true);
    setDrafted(false);
    try {
      const res = await fetch("/api/education/spc-meeting/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalType: data.type,
          students: data.students,
          refDoc: data.refDoc,
        }),
      });
      const result = await res.json();
      if (result.title) update({ title: result.title, description: result.description });
      setDrafted(true);
    } catch (err) {
      console.error("Draft failed:", err);
    } finally {
      setDrafting(false);
    }
  };

  return (
    <div className="rounded-lg border border-cy-border">
      {/* Proposal header */}
      <div className="flex items-center gap-2 border-b border-cy-border px-3 py-2">
        <button onClick={() => setCollapsed(!collapsed)} className="text-cy-muted hover:text-cy-text">
          {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>
        <span className="text-xs font-medium text-cy-text">案由 {index + 1}</span>
        {data.type && <span className="text-xs text-cy-muted">— {data.type}</span>}
        <div className="flex-1" />
        {canRemove && (
          <button onClick={onRemove} className="text-xs text-cy-muted hover:text-cy-error">
            移除
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="space-y-4 p-3">
          {/* Type selector */}
          <div className="flex items-center gap-3">
            <label className="w-20 shrink-0 text-right text-xs text-cy-muted">案由類型</label>
            <select
              value={data.type}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="flex-1 rounded-md border border-cy-border bg-cy-input px-3 py-1.5 text-sm text-cy-text focus:border-cy-accent focus:outline-none"
            >
              <option value="">請選擇</option>
              {PROPOSAL_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Students */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-cy-muted">涉及學生</label>
            <StudentPicker
              value={data.students}
              onChange={(students) => update({ students })}
            />
          </div>

          {/* Ref doc */}
          <div className="flex items-center gap-3">
            <label className="w-20 shrink-0 text-right text-xs text-cy-muted">公文字號</label>
            <input
              value={data.refDoc}
              onChange={(e) => update({ refDoc: e.target.value })}
              placeholder="選填"
              className="flex-1 rounded-md border border-cy-border bg-cy-input px-3 py-1.5 text-sm text-cy-text focus:border-cy-accent focus:outline-none"
            />
          </div>

          {/* History reference */}
          <HistoryReference records={historyRecords} loading={historyLoading} />

          {/* AI Draft button */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleDraft}
              disabled={drafting || !data.type}
              className="flex items-center gap-1.5 rounded-md bg-cy-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-cy-accent/90 disabled:opacity-50 transition-colors"
            >
              {drafting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : drafted ? (
                <RefreshCw className="h-3.5 w-3.5" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              {drafting ? "AI 草擬中..." : drafted ? "重新生成" : "AI 草擬說明"}
            </button>
          </div>

          {/* Draft result: title */}
          {(data.title || drafted) && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-cy-muted">【案由】</label>
              <input
                value={data.title}
                onChange={(e) => update({ title: e.target.value })}
                className="w-full rounded-md border border-cy-border bg-cy-input px-3 py-1.5 text-sm text-cy-text focus:border-cy-accent focus:outline-none"
              />
            </div>
          )}

          {/* Draft result: description */}
          {(data.description || drafted) && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-cy-muted">【說明】</label>
              <textarea
                value={data.description}
                onChange={(e) => update({ description: e.target.value })}
                rows={6}
                className="w-full rounded-md border border-cy-border bg-cy-input px-3 py-2 text-sm text-cy-text focus:border-cy-accent focus:outline-none resize-y"
              />
            </div>
          )}

          {/* Decision */}
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
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create PreviousDecisions**

```typescript
// src/components/skills/workstations/education/spc-meeting/previous-decisions.tsx
"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface PreviousDecisionsProps {
  academicYear: number;
  meetingNumber: number;
  value: string;
  onChange: (value: string) => void;
}

export function PreviousDecisions({ academicYear, meetingNumber, value, onChange }: PreviousDecisionsProps) {
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded || meetingNumber <= 1 || !academicYear) return;

    setLoading(true);
    fetch(`/api/education/spc-meeting/history?year=${academicYear}&meetingNumber=${meetingNumber}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.previousDecisions && !value) {
          onChange(data.previousDecisions);
        }
        setLoaded(true);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [academicYear, meetingNumber, loaded, value, onChange]);

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <label className="text-xs font-medium text-cy-muted">前次會議決議追蹤</label>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-cy-muted" />}
        {loaded && meetingNumber > 1 && (
          <span className="text-[10px] text-cy-muted">
            （自動從第 {meetingNumber - 1} 次帶入）
          </span>
        )}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={meetingNumber <= 1 ? "第一次會議，無前次決議" : "載入中..."}
        rows={4}
        className="w-full rounded-md border border-cy-border bg-cy-input px-3 py-2 text-sm text-cy-text focus:border-cy-accent focus:outline-none resize-y"
      />
    </div>
  );
}
```

- [ ] **Step 3: Create BusinessReportEditor**

```typescript
// src/components/skills/workstations/education/spc-meeting/business-report-editor.tsx
"use client";

interface BusinessReportEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function BusinessReportEditor({ value, onChange }: BusinessReportEditorProps) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-cy-muted">資源班業務報告</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="本學期資源班重要行事..."
        rows={4}
        className="w-full rounded-md border border-cy-border bg-cy-input px-3 py-2 text-sm text-cy-text focus:border-cy-accent focus:outline-none resize-y"
      />
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `cd /Users/kangyunsheng/CycloneOS && npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/skills/workstations/education/spc-meeting/proposal-form.tsx \
  src/components/skills/workstations/education/spc-meeting/previous-decisions.tsx \
  src/components/skills/workstations/education/spc-meeting/business-report-editor.tsx
git commit -m "feat(education): SPC meeting sub-components — ProposalForm, PreviousDecisions, BusinessReportEditor"
```

---

### Task 10: Wire up SpcMeetingPanel — complete 4-step flow

Replace the stub panel with the full 4-step flow wiring all components together.

**Files:**
- Modify: `src/components/skills/workstations/education/spc-meeting/spc-meeting-panel.tsx`

- [ ] **Step 1: Replace stub with full implementation**

```typescript
// src/components/skills/workstations/education/spc-meeting/spc-meeting-panel.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Plus, Settings } from "lucide-react";
import { MeetingHeaderForm, type FieldDef } from "../shared/meeting-header-form";
import { DownloadPanel } from "../shared/download-panel";
import { CommitteeManager } from "./committee-manager";
import { ProposalForm, type ProposalData } from "./proposal-form";
import { PreviousDecisions } from "./previous-decisions";
import { BusinessReportEditor } from "./business-report-editor";
import { MeetingSectionEditor, type SectionDef } from "../shared/meeting-section-editor";
import type { CommitteeMember } from "@/lib/education/committee-parser";

interface SpcMeetingPanelProps {
  onBack: () => void;
}

const SCHOOL_DEFAULTS = {
  academicYear: "114",
  location: "本校三樓共讀站",
  timeStart: "上午08:10",
};

const EMPTY_PROPOSAL: ProposalData = {
  type: "",
  title: "",
  description: "",
  decision: "",
  students: [],
  refDoc: "",
};

type Step = 1 | 2 | 3 | 4;

export function SpcMeetingPanel({ onBack }: SpcMeetingPanelProps) {
  const [step, setStep] = useState<Step>(1);

  // Step 1: Basic info
  const [headerValues, setHeaderValues] = useState<Record<string, string>>({
    academicYear: SCHOOL_DEFAULTS.academicYear,
    location: SCHOOL_DEFAULTS.location,
    timeStart: SCHOOL_DEFAULTS.timeStart,
    meetingNumber: "",
    meetingDate: "",
    chair: "",
    recorder: "",
  });
  const [committee, setCommittee] = useState<CommitteeMember[]>([]);
  const [committeeOpen, setCommitteeOpen] = useState(false);

  // Step 2: Decisions + report
  const [previousDecisions, setPreviousDecisions] = useState("");
  const [businessReport, setBusinessReport] = useState("");

  // Step 3: Proposals
  const [proposals, setProposals] = useState<ProposalData[]>([{ ...EMPTY_PROPOSAL }]);

  // Step 4: Final
  const [finalSections, setFinalSections] = useState<Record<string, string>>({
    motions: "無",
    timeEnd: "",
  });
  const [generating, setGenerating] = useState(false);
  const [downloadResult, setDownloadResult] = useState<{
    docxUrl?: string;
    docxFilename?: string;
    mdPath?: string;
    mocUpdated?: boolean;
  } | null>(null);

  // Load committee on mount
  const loadCommittee = useCallback(async () => {
    const year = parseInt(headerValues.academicYear, 10);
    if (isNaN(year)) return;
    try {
      const res = await fetch(`/api/education/committee?year=${year}`);
      const data = await res.json();
      if (data.members?.length) {
        setCommittee(data.members);
        // Auto-fill chair and recorder from roster
        const chair = data.members.find((m: CommitteeMember) => m.role === "主席");
        const recorder = data.members.find((m: CommitteeMember) => m.role.includes("記錄"));
        if (chair) setHeaderValues((v) => ({ ...v, chair: chair.name }));
        if (recorder) setHeaderValues((v) => ({ ...v, recorder: recorder.name }));
      }
    } catch {
      // No roster
    }
  }, [headerValues.academicYear]);

  useEffect(() => {
    loadCommittee();
  }, [loadCommittee]);

  // Build header field definitions
  const chairOptions = committee.map((m) => ({ label: `${m.title} ${m.name}`, value: m.name }));
  const recorderOptions = committee.map((m) => ({ label: `${m.title} ${m.name}`, value: m.name }));

  const headerFields: FieldDef[] = [
    { key: "academicYear", label: "學年度", type: "number", defaultValue: SCHOOL_DEFAULTS.academicYear },
    { key: "meetingNumber", label: "第幾次", type: "number", placeholder: "例：5" },
    { key: "meetingDate", label: "會議日期", type: "text", placeholder: "例：115年4月5日" },
    { key: "timeStart", label: "開始時間", type: "text", defaultValue: SCHOOL_DEFAULTS.timeStart },
    { key: "location", label: "地點", type: "text", defaultValue: SCHOOL_DEFAULTS.location },
    {
      key: "chair",
      label: "主席",
      type: committee.length > 0 ? "select" : "text",
      options: chairOptions,
    },
    {
      key: "recorder",
      label: "記錄",
      type: committee.length > 0 ? "select" : "text",
      options: recorderOptions,
    },
  ];

  const updateHeader = (key: string, value: string) => {
    setHeaderValues((v) => ({ ...v, [key]: value }));
  };

  // Proposal management
  const addProposal = () => setProposals([...proposals, { ...EMPTY_PROPOSAL }]);
  const updateProposal = (index: number, data: ProposalData) => {
    setProposals(proposals.map((p, i) => (i === index ? data : p)));
  };
  const removeProposal = (index: number) => {
    setProposals(proposals.filter((_, i) => i !== index));
  };

  // Generate
  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const body = {
        academicYear: parseInt(headerValues.academicYear, 10),
        meetingNumber: parseInt(headerValues.meetingNumber, 10),
        date: headerValues.meetingDate,
        timeStart: headerValues.timeStart,
        timeEnd: finalSections.timeEnd,
        location: headerValues.location,
        chair: headerValues.chair,
        recorder: headerValues.recorder,
        businessReport,
        previousTracking: previousDecisions,
        proposals: proposals.map((p) => ({
          type: p.type,
          title: p.title,
          description: p.description,
          decision: p.decision,
          students: p.students,
          refDoc: p.refDoc,
        })),
        motions: finalSections.motions,
        committee: committee.map((m) => ({ title: m.title, name: m.name, role: m.role })),
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
        const filename = filenameMatch ? decodeURIComponent(filenameMatch[1]) : "meeting.docx";

        setDownloadResult({
          docxUrl: url,
          docxFilename: filename,
          mdPath: res.headers.get("X-Md-Path") ?? undefined,
          mocUpdated: res.headers.get("X-Moc-Updated") === "true",
        });
      }
    } catch (err) {
      console.error("Generate failed:", err);
    } finally {
      setGenerating(false);
    }
  };

  const finalSectionDefs: SectionDef[] = [
    { key: "motions", label: "臨時動議", placeholder: "無", minRows: 2 },
    { key: "timeEnd", label: "散會時間", placeholder: "例：上午09:00", minRows: 1 },
  ];

  const STEPS = ["基本資訊", "前次決議＋業務報告", "提案討論", "確認＋下載"];

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 5.5rem)" }}>
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
        <h1 className="text-lg font-bold text-cy-text">特推會會議記錄</h1>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1 py-3">
        {STEPS.map((label, i) => (
          <button
            key={i}
            onClick={() => setStep((i + 1) as Step)}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${
              step === i + 1
                ? "bg-cy-accent text-white"
                : "bg-cy-input/50 text-cy-muted hover:text-cy-text"
            }`}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto py-4">
        <div className="mx-auto max-w-2xl space-y-6">
          {step === 1 && (
            <>
              <MeetingHeaderForm
                fields={headerFields}
                values={headerValues}
                onChange={updateHeader}
              />
              <div className="flex items-center gap-2 text-xs text-cy-muted">
                <span>委員名冊：{headerValues.academicYear} 學年度 ({committee.length} 人)</span>
                <button
                  onClick={() => setCommitteeOpen(true)}
                  className="flex items-center gap-1 text-cy-accent hover:text-cy-accent/80"
                >
                  <Settings className="h-3 w-3" />
                  管理
                </button>
              </div>
              <CommitteeManager
                year={parseInt(headerValues.academicYear, 10) || 114}
                isOpen={committeeOpen}
                onClose={() => setCommitteeOpen(false)}
                onSaved={(members) => {
                  setCommittee(members);
                  const chair = members.find((m) => m.role === "主席");
                  const recorder = members.find((m) => m.role.includes("記錄"));
                  if (chair) updateHeader("chair", chair.name);
                  if (recorder) updateHeader("recorder", recorder.name);
                }}
              />
              <button
                onClick={() => setStep(2)}
                className="rounded-md bg-cy-accent px-4 py-2 text-sm font-medium text-white hover:bg-cy-accent/90 transition-colors"
              >
                下一步
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <PreviousDecisions
                academicYear={parseInt(headerValues.academicYear, 10) || 114}
                meetingNumber={parseInt(headerValues.meetingNumber, 10) || 1}
                value={previousDecisions}
                onChange={setPreviousDecisions}
              />
              <BusinessReportEditor
                value={businessReport}
                onChange={setBusinessReport}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setStep(1)}
                  className="rounded-md border border-cy-border px-4 py-2 text-sm text-cy-muted hover:text-cy-text transition-colors"
                >
                  上一步
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="rounded-md bg-cy-accent px-4 py-2 text-sm font-medium text-white hover:bg-cy-accent/90 transition-colors"
                >
                  下一步
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="space-y-4">
                {proposals.map((p, i) => (
                  <ProposalForm
                    key={i}
                    index={i}
                    data={p}
                    onChange={(data) => updateProposal(i, data)}
                    onRemove={() => removeProposal(i)}
                    canRemove={proposals.length > 1}
                  />
                ))}
              </div>
              <button
                onClick={addProposal}
                className="flex items-center gap-1.5 text-xs text-cy-accent hover:text-cy-accent/80"
              >
                <Plus className="h-3.5 w-3.5" />
                新增案由
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setStep(2)}
                  className="rounded-md border border-cy-border px-4 py-2 text-sm text-cy-muted hover:text-cy-text transition-colors"
                >
                  上一步
                </button>
                <button
                  onClick={() => setStep(4)}
                  className="rounded-md bg-cy-accent px-4 py-2 text-sm font-medium text-white hover:bg-cy-accent/90 transition-colors"
                >
                  下一步
                </button>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <MeetingSectionEditor
                sections={finalSectionDefs}
                values={finalSections}
                onChange={(key, val) => setFinalSections((v) => ({ ...v, [key]: val }))}
              />
              <DownloadPanel
                result={downloadResult}
                loading={generating}
                onGenerate={handleGenerate}
                generateLabel="生成會議記錄"
              />
              <button
                onClick={() => setStep(3)}
                className="rounded-md border border-cy-border px-4 py-2 text-sm text-cy-muted hover:text-cy-text transition-colors"
              >
                上一步
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/kangyunsheng/CycloneOS && npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Manual smoke test**

Run: `cd /Users/kangyunsheng/CycloneOS && npm run dev`

Verify:
1. Click 🎓 教育工作站 → see sub-module grid
2. Click 📋 特推會會議記錄 → see 4-step panel
3. Step 1: fill basic info, click 管理 → committee modal opens
4. Step 2: previous decisions auto-loads (if meeting > 1), business report textarea works
5. Step 3: add proposal, select type, add students, click AI 草擬
6. Step 4: generate button visible
7. Back navigation works at every level

- [ ] **Step 4: Commit**

```bash
git add src/components/skills/workstations/education/spc-meeting/spc-meeting-panel.tsx
git commit -m "feat(education): complete SPC meeting panel — 4-step flow with all components wired"
```

---

### Task 11: Python script `--json` mode for API integration

The API routes send JSON via stdin to `spc_meeting_core.py`. Add a `--json` mode that reads stdin, dispatches to the right function, and outputs JSON to stdout.

**Files:**
- Modify: `scripts/education/spc_meeting_core.py` (add `--json` entrypoint)

- [ ] **Step 1: Read current spc_meeting_core.py to understand its structure**

Run: Read the full file to understand existing functions before modifying.

- [ ] **Step 2: Add `--json` CLI entrypoint**

Add to the bottom of `scripts/education/spc_meeting_core.py`:

```python
def handle_json_mode():
    """JSON mode: read action + data from stdin, output result to stdout."""
    import sys
    import json

    data = json.loads(sys.stdin.read())
    action = data.get("action")

    if action == "draft":
        # Draft a proposal description
        proposal_type = data["proposal_type"]
        students = data.get("students", [])
        ref_doc = data.get("ref_doc", "")

        similar = fetch_similar_meetings(proposal_type)
        result = draft_proposal(proposal_type, students, ref_doc, similar)
        print(json.dumps(result, ensure_ascii=False))

    elif action == "generate":
        # Generate full meeting record (.docx + .md)
        record = build_meeting_record(data)
        docx_path = generate_docx(record, data.get("output_dir"))
        md_path = save_markdown(record)
        moc_updated = update_moc(record)
        print(json.dumps({
            "docx_path": docx_path,
            "md_path": md_path,
            "moc_updated": moc_updated,
        }, ensure_ascii=False))

    else:
        print(json.dumps({"error": f"Unknown action: {action}"}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    import sys
    if "--json" in sys.argv:
        handle_json_mode()
    else:
        print("Usage: python3 spc_meeting_core.py --json < input.json")
        print("Or use spc_meeting_cli.py for interactive mode.")
```

Note: The exact implementation depends on the current state of `spc_meeting_core.py`. The functions `fetch_similar_meetings`, `draft_proposal`, `generate_docx`, `save_markdown`, `update_moc`, and `build_meeting_record` may need minor adjustments. Read the file first and adapt.

- [ ] **Step 3: Test the JSON mode locally**

```bash
echo '{"action":"draft","proposal_type":"交通補助","students":[{"name":"廖祐仁","className":"四甲","disability":"中度智障","detail":"祖父接送"}],"ref_doc":""}' | python3 scripts/education/spc_meeting_core.py --json
```

Expected: JSON output with `title` and `description` fields.

- [ ] **Step 4: Commit**

```bash
git add scripts/education/spc_meeting_core.py
git commit -m "feat(education): add --json mode to spc_meeting_core.py for API integration"
```

---

## Deferred to Phase 2

The following spec items are intentionally deferred:

- **MeetingPreview** (shared read-only preview component) — SPC panel uses editable SectionEditor directly; a read-only preview mode will be needed for IEP's split-tab view
- **IEP meeting panel** — all IEP-specific components (AudioUploader, WhisperProgress, MeetingTypePicker, SplitTabs) and API routes (transcribe, analyze, generate)
- These will be covered in a separate Phase 2 plan

---

## Dependency Graph

```
Task 1 (Entry page + routing)
    ↓
Task 2 (HeaderForm + SectionEditor) ─────────────────────────────┐
    ↓                                                             │
Task 3 (StudentPicker + DownloadPanel + HistoryReference)         │
    ↓                                                             │
Task 4 (Obsidian paths + committee parser)                        │
    ↓                                                             │
Task 5 (Committee API) ──→ Task 6 (CommitteeManager component)   │
                                ↓                                 │
Task 7 (SPC history + draft API) ──→ Task 9 (SPC sub-components) │
    ↓                                    ↓                        │
Task 8 (SPC generate API) ────→ Task 10 (SpcMeetingPanel) ←──────┘
    ↑                                    ↑
Task 11 (Python --json mode) ────────────┘
```

Tasks 1-4 are strictly sequential. Tasks 5-6, 7-9, and 8 can be parallelized. Task 10 depends on everything. Task 11 can be done anytime before Task 10's smoke test.
