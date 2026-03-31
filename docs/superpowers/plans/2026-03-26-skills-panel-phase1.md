# Skills Panel Phase 1 — 面板骨架 + 卡片目錄

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Skills panel with card catalog UI, workstation expand/collapse mechanism, Documents sidebar shortcut, and placeholder workstations.

**Architecture:** Skills panel is a new page within the existing dashboard layout. It uses a static config array for skill cards, Zustand store for workstation state, and conditional full-width rendering when a workstation is expanded. Each workstation is a placeholder component for now.

**Tech Stack:** Next.js, React, Zustand, Tailwind CSS, Lucide icons

**Spec:** `docs/superpowers/specs/2026-03-26-skills-panel-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `dashboard/src/stores/app-store.ts` | Modify | Remove `"pipeline"`, add `activeWorkstation` + `navigateTo` |
| `dashboard/src/config/skills-config.ts` | Create | `SkillCard` interface + `SKILLS` array |
| `dashboard/src/components/skills/skill-card.tsx` | Create | Single card component |
| `dashboard/src/components/skills/skill-search.tsx` | Create | Search box with debounce |
| `dashboard/src/components/skills/skills-panel.tsx` | Create | Main panel: card grid + workstation switch |
| `dashboard/src/components/skills/workstations/workstation-placeholder.tsx` | Create | Shared placeholder for unbuilt workstations |
| `dashboard/src/components/layout/sidebar.tsx` | Modify | Documents shortcut (independent button with `navigateTo`) |
| `dashboard/src/components/layout/dashboard-panel.tsx` | Modify | Remove `pipeline`, register `SkillsPanel` |
| `dashboard/src/components/layout/resizable-layout.tsx` | Modify | Full-width when workstation expanded |

---

### Task 1: Update app-store — remove pipeline, add workstation state

**Files:**
- Modify: `dashboard/src/stores/app-store.ts`

- [ ] **Step 1: Update SidebarPage type and store**

Replace the entire file with:

```typescript
// dashboard/src/stores/app-store.ts
import { create } from "zustand";

export type SidebarPage =
  | "overview"
  | "gmail"
  | "drive"
  | "skills"
  | "timeline"
  | "search"
  | "settings";

interface AppState {
  activePage: SidebarPage;
  activeWorkstation: string | null;
  setActivePage: (page: SidebarPage) => void;
  setActiveWorkstation: (id: string | null) => void;
  navigateTo: (page: SidebarPage, workstation?: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activePage: "overview",
  activeWorkstation: null,
  setActivePage: (page) => set({ activePage: page, activeWorkstation: null }),
  setActiveWorkstation: (id) => set({ activeWorkstation: id }),
  navigateTo: (page, workstation = null) =>
    set({ activePage: page, activeWorkstation: workstation }),
}));
```

- [ ] **Step 2: Commit**

Note: Build will fail until Tasks 7-8 remove remaining `"pipeline"` references. This is expected.

```bash
git add dashboard/src/stores/app-store.ts
git commit -m "refactor(store): remove pipeline, add activeWorkstation and navigateTo"
```

---

### Task 2: Create skills-config.ts

**Files:**
- Create: `dashboard/src/config/skills-config.ts`

- [ ] **Step 1: Create the config file**

```typescript
// dashboard/src/config/skills-config.ts

export interface SkillCard {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: "workstation" | "chat";
  tags: string[];
  chatCommand?: string;
}

export const SKILLS: SkillCard[] = [
  {
    id: "documents",
    name: "Documents 工作站",
    description: "複合式資料處理：多源讀取→AI加工→多格式輸出",
    icon: "📄",
    type: "workstation",
    tags: ["PDF", "OCR", "合併", "拆分", "簡報", "Excel", "會議紀錄"],
  },
  {
    id: "gov-doc",
    name: "公文處理工作站",
    description: "公文掃描→AI分析→分類歸檔→進階管理",
    icon: "📜",
    type: "workstation",
    tags: ["公文", "歸檔", "掃描", "分類"],
  },
  {
    id: "education",
    name: "教育工作站",
    description: "IEP・課程計畫・教案・學習單・教材設計",
    icon: "🎓",
    type: "workstation",
    tags: ["IEP", "課程計畫", "教案", "學習單", "特教"],
  },
  {
    id: "transcribe",
    name: "語音轉錄工作站",
    description: "YT影片・手機錄音・電腦錄影→逐字稿→文件產出",
    icon: "🎙️",
    type: "workstation",
    tags: ["YT", "錄音", "逐字稿", "Whisper", "轉錄"],
  },
  {
    id: "social",
    name: "社群發文模組",
    description: "FB・IG・Threads・Notion 格式切換與自動化發文",
    icon: "📱",
    type: "workstation",
    tags: ["Facebook", "Instagram", "Threads", "Notion", "社群"],
  },
];
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/config/skills-config.ts
git commit -m "feat(skills): add skills config with 5 workstation definitions"
```

---

### Task 3: Create skill-card component

**Files:**
- Create: `dashboard/src/components/skills/skill-card.tsx`

- [ ] **Step 1: Create the component**

```typescript
"use client";

import type { SkillCard as SkillCardType } from "@/config/skills-config";
import { ArrowRight, MessageSquare } from "lucide-react";

interface SkillCardProps {
  skill: SkillCardType;
  onClick: () => void;
}

export function SkillCard({ skill, onClick }: SkillCardProps) {
  const isWorkstation = skill.type === "workstation";

  return (
    <button
      onClick={onClick}
      className="group flex flex-col gap-3 rounded-lg border border-cy-border bg-gradient-to-br from-cy-card to-cy-card/60 p-4 text-left transition-all duration-200 hover:border-cy-accent/30 hover:shadow-lg hover:shadow-cy-accent/5"
    >
      <div className="flex items-start justify-between">
        <span className="text-2xl">{skill.icon}</span>
        <span
          className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium ${
            isWorkstation
              ? "bg-cy-accent/10 text-cy-accent"
              : "bg-blue-500/10 text-blue-400"
          }`}
        >
          {isWorkstation ? (
            <>
              展開 <ArrowRight className="h-2.5 w-2.5" />
            </>
          ) : (
            <>
              <MessageSquare className="h-2.5 w-2.5" /> Chat
            </>
          )}
        </span>
      </div>
      <div>
        <h3 className="text-sm font-bold text-cy-text group-hover:text-cy-accent transition-colors">
          {skill.name}
        </h3>
        <p className="mt-1 text-xs text-cy-muted leading-relaxed">
          {skill.description}
        </p>
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/components/skills/skill-card.tsx
git commit -m "feat(skills): add SkillCard component"
```

---

### Task 4: Create skill-search component

**Files:**
- Create: `dashboard/src/components/skills/skill-search.tsx`

- [ ] **Step 1: Create the component**

```typescript
"use client";

import { useState, useEffect } from "react";
import { Search } from "lucide-react";

interface SkillSearchProps {
  onSearch: (query: string) => void;
}

export function SkillSearch({ onSearch }: SkillSearchProps) {
  const [input, setInput] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => onSearch(input), 200);
    return () => clearTimeout(timer);
  }, [input, onSearch]);

  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-cy-muted" />
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="搜尋技能..."
        className="w-48 rounded-md border border-cy-border bg-cy-input/50 py-1.5 pl-8 pr-3 text-xs text-cy-text placeholder:text-cy-muted focus:border-cy-accent/50 focus:outline-none"
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/components/skills/skill-search.tsx
git commit -m "feat(skills): add SkillSearch component with 200ms debounce"
```

---

### Task 5: Create workstation-placeholder component

**Files:**
- Create: `dashboard/src/components/skills/workstations/workstation-placeholder.tsx`

- [ ] **Step 1: Create the component**

```typescript
"use client";

import { ArrowLeft } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import type { SkillCard } from "@/config/skills-config";

interface WorkstationPlaceholderProps {
  skill: SkillCard;
}

export function WorkstationPlaceholder({ skill }: WorkstationPlaceholderProps) {
  const { setActiveWorkstation } = useAppStore();

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
        <span className="text-lg">{skill.icon}</span>
        <h1 className="text-lg font-bold text-cy-text">{skill.name}</h1>
      </div>

      {/* Placeholder content */}
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <span className="text-5xl">{skill.icon}</span>
          <h2 className="mt-4 text-lg font-bold text-cy-text">{skill.name}</h2>
          <p className="mt-2 text-sm text-cy-muted">Coming Soon</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {skill.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-cy-input/50 px-3 py-1 text-xs text-cy-muted"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/components/skills/workstations/workstation-placeholder.tsx
git commit -m "feat(skills): add WorkstationPlaceholder component"
```

---

### Task 6: Create skills-panel — main panel with card grid + workstation switching

**Files:**
- Create: `dashboard/src/components/skills/skills-panel.tsx`

- [ ] **Step 1: Create the main panel component**

```typescript
"use client";

import { useCallback, useMemo } from "react";
import { useAppStore } from "@/stores/app-store";
import { SKILLS } from "@/config/skills-config";
import { SkillCard } from "./skill-card";
import { SkillSearch } from "./skill-search";
import { WorkstationPlaceholder } from "./workstations/workstation-placeholder";
import { useState } from "react";

export function SkillsPanel() {
  const { activeWorkstation, setActiveWorkstation } = useAppStore();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return SKILLS;
    const q = searchQuery.toLowerCase();
    return SKILLS.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  const handleCardClick = (skillId: string) => {
    const skill = SKILLS.find((s) => s.id === skillId);
    if (!skill) return;
    if (skill.type === "workstation") {
      setActiveWorkstation(skillId);
    }
    // Future: Chat skill → trigger chatCommand in Chat panel
  };

  // Workstation expanded view
  if (activeWorkstation) {
    const skill = SKILLS.find((s) => s.id === activeWorkstation);
    if (!skill) {
      // Invalid workstation ID — render nothing, user can navigate away
      return null;
    }
    // Future: switch on activeWorkstation to render real workstation components
    // e.g. case "documents": return <DocumentsWorkstation />;
    return <WorkstationPlaceholder skill={skill} />;
  }

  // Card catalog view
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-cy-text">Skills</h1>
        <SkillSearch onSearch={handleSearch} />
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-cy-muted">
          找不到符合「{searchQuery}」的技能
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              onClick={() => handleCardClick(skill.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/components/skills/skills-panel.tsx
git commit -m "feat(skills): add SkillsPanel with card grid and workstation switching"
```

---

### Task 7: Update sidebar — Documents shortcut + remove pipeline

**Files:**
- Modify: `dashboard/src/components/layout/sidebar.tsx`

- [ ] **Step 1: Update sidebar**

Replace the entire file with:

```typescript
"use client";

import { useAppStore, type SidebarPage } from "@/stores/app-store";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { LayoutDashboard, Mail, HardDrive, FileText, Search, ListTodo, Settings, Clock, Sparkles, type LucideIcon } from "lucide-react";

const NAV_ITEMS: { page: SidebarPage; icon: LucideIcon; label: string }[] = [
  { page: "overview", icon: LayoutDashboard, label: "Overview" },
  { page: "gmail", icon: Mail, label: "Gmail" },
  { page: "drive", icon: HardDrive, label: "Drive" },
];

const NAV_AFTER_DOCS: { page: SidebarPage; icon: LucideIcon; label: string }[] = [
  { page: "skills", icon: Sparkles, label: "Skills" },
  { page: "timeline", icon: Clock, label: "Timeline" },
];

const BOTTOM_NAV: { page: SidebarPage; icon: LucideIcon; label: string }[] = [
  { page: "search", icon: Search, label: "Search" },
];

const EXTERNAL_LINKS: { icon: LucideIcon; label: string; url: string }[] = [
  { icon: ListTodo, label: "Tasks (Notion)", url: "https://notion.so" },
];

function NavButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        onClick={onClick}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-md text-lg transition-all duration-200",
          active
            ? "bg-cy-accent/15 text-cy-accent cy-glow"
            : "text-cy-muted hover:bg-cy-input/40 hover:text-cy-text"
        )}
      >
        <Icon className="h-4.5 w-4.5" strokeWidth={1.8} />
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

export function Sidebar() {
  const { activePage, activeWorkstation, setActivePage, navigateTo } = useAppStore();

  // Documents is "active" when skills page has documents workstation open
  const isDocumentsActive = activePage === "skills" && activeWorkstation === "documents";

  return (
    <TooltipProvider delay={0}>
      <div className="flex h-full w-14 flex-col items-center border-r border-cy-border bg-cy-card/80 py-3 gap-1 backdrop-blur-sm">
        {/* Logo */}
        <div className="mb-4 flex h-9 w-9 items-center justify-center">
          <Image src="/logo.png" alt="CycloneOS" width={32} height={32} className="rounded-md" />
        </div>

        {/* Nav before Documents */}
        {NAV_ITEMS.map((item) => (
          <NavButton
            key={item.page}
            icon={item.icon}
            label={item.label}
            active={activePage === item.page}
            onClick={() => setActivePage(item.page)}
          />
        ))}

        {/* Documents shortcut */}
        <NavButton
          icon={FileText}
          label="Documents"
          active={isDocumentsActive}
          onClick={() => navigateTo("skills", "documents")}
        />

        {/* Nav after Documents */}
        {NAV_AFTER_DOCS.map((item) => (
          <NavButton
            key={item.page}
            icon={item.icon}
            label={item.label}
            active={activePage === item.page && (item.page !== "skills" || !activeWorkstation)}
            onClick={() => setActivePage(item.page)}
          />
        ))}

        {/* External Links */}
        <div className="my-2 h-px w-6 bg-cy-border" />
        {EXTERNAL_LINKS.map((link) => (
          <Tooltip key={link.label}>
            <TooltipTrigger
              onClick={() => window.open(link.url, "_blank", "noopener,noreferrer")}
              className="flex h-9 w-9 items-center justify-center rounded-md text-lg text-cy-muted transition-colors hover:bg-cy-input/50 hover:text-cy-text"
            >
              <link.icon className="h-4.5 w-4.5" strokeWidth={1.8} />
            </TooltipTrigger>
            <TooltipContent side="right">{link.label}</TooltipContent>
          </Tooltip>
        ))}

        <div className="flex-1" />

        {/* Bottom Nav */}
        {BOTTOM_NAV.map((item) => (
          <NavButton
            key={item.page}
            icon={item.icon}
            label={item.label}
            active={activePage === item.page}
            onClick={() => setActivePage(item.page)}
          />
        ))}

        {/* Settings — softer styling, no glow */}
        <Tooltip>
          <TooltipTrigger
            onClick={() => setActivePage("settings")}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-md text-lg transition-colors",
              activePage === "settings"
                ? "bg-cy-accent/20 text-cy-accent"
                : "text-cy-muted hover:bg-cy-input/50 hover:text-cy-text"
            )}
          >
            <Settings className="h-4.5 w-4.5" strokeWidth={1.8} />
          </TooltipTrigger>
          <TooltipContent side="right">Settings</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/components/layout/sidebar.tsx
git commit -m "refactor(sidebar): Documents shortcut via navigateTo, remove pipeline"
```

---

### Task 8: Update dashboard-panel — remove pipeline, register SkillsPanel

**Files:**
- Modify: `dashboard/src/components/layout/dashboard-panel.tsx`

- [ ] **Step 1: Update imports and PAGE_COMPONENTS**

Add import at top (after other imports):

```typescript
import { SkillsPanel } from "@/components/skills/skills-panel";
```

Replace the PAGE_COMPONENTS record:

```typescript
const PAGE_COMPONENTS: Record<SidebarPage, ReactNode> = {
  overview: <OverviewPage />,
  gmail: <GmailPanel />,
  drive: <DrivePanel />,
  skills: <SkillsPanel />,
  timeline: <TimelinePanel />,
  search: <PlaceholderPage title="Search" description="Cross-source search — coming soon" />,
  settings: <PlaceholderPage title="Settings" description="Settings — coming soon" />,
};
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/components/layout/dashboard-panel.tsx
git commit -m "feat(dashboard): register SkillsPanel, remove pipeline page"
```

---

### Task 9: Update resizable-layout — full-width when workstation expanded

**Files:**
- Modify: `dashboard/src/components/layout/resizable-layout.tsx`

- [ ] **Step 1: Update full-width logic**

Replace the entire file with:

```typescript
"use client";

import { Panel, Group, Separator } from "react-resizable-panels";
import { Sidebar } from "./sidebar";
import { DashboardPanel } from "./dashboard-panel";
import { useAppStore, type SidebarPage } from "@/stores/app-store";

const FULL_WIDTH_PAGES: SidebarPage[] = ["timeline", "settings"];

export function ResizableLayout({ chatPanel }: { chatPanel: React.ReactNode }) {
  const { activePage, activeWorkstation } = useAppStore();
  const isFullWidth =
    FULL_WIDTH_PAGES.includes(activePage) ||
    (activePage === "skills" && activeWorkstation !== null);

  return (
    <div className="flex h-screen">
      <Sidebar />
      {!isFullWidth ? (
        <Group orientation="horizontal">
          <Panel defaultSize={60} minSize={30}>
            <DashboardPanel />
          </Panel>
          <Separator className="w-px bg-cy-border hover:bg-cy-accent/30 transition-colors" />
          <Panel defaultSize={40} minSize={25}>
            {chatPanel}
          </Panel>
        </Group>
      ) : (
        <div className="flex-1 overflow-hidden">
          <DashboardPanel />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/components/layout/resizable-layout.tsx
git commit -m "feat(layout): full-width mode when workstation expanded"
```

---

### Task 10: Build verification + final commit

- [ ] **Step 1: Run build**

Run: `cd /Users/username/CycloneOpenClaw/dashboard && npx next build 2>&1 | tail -10`

Expected: Build succeeds with no errors.

- [ ] **Step 2: Start dev server and verify in browser**

Run: `cd /Users/username/CycloneOpenClaw/dashboard && npx next dev -p 3000`

Verify:
1. Skills page shows 5 cards in a 3-column grid
2. Clicking a card expands to workstation placeholder (full-width, chat panel hidden)
3. Back button returns to card catalog
4. Documents sidebar button opens Skills + Documents workstation directly
5. Skills sidebar button (when Documents workstation is open) returns to card catalog
6. Search filters cards by name/description/tags
7. Other sidebar pages (Gmail, Drive, etc.) work normally

- [ ] **Step 3: Commit all remaining changes if any**

```bash
git add -A
git commit -m "feat(skills): Skills panel Phase 1 complete — card catalog + workstation skeleton"
```
