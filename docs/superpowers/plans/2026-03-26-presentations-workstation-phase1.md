# Presentations Workstation Implementation Plan (Phase P0-P2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a functional Presentations Workstation with reveal.js rendering, outline editing, and drag-and-drop visual positioning.

**Architecture:** Multi-Renderer architecture where SlideOutline JSON is the single source of truth. This plan covers the reveal.js renderer path end-to-end with outline editor. Canva/Felo integration deferred to Phase P3-P5 (separate plan).

**Note on POCs:** The spec's Phase P0 includes POC tasks for Canva editing flow, Felo PPT API, and Felo image generation. These POCs are deferred to the Phase P3-P5 plan since this plan focuses on the reveal.js path which is fully validated. If a POC fails later, the spec architecture may need revision but the reveal.js path built here remains usable.

**Tech Stack:** Next.js 16, React 19, Zustand 5 (with persist), @dnd-kit/core + sortable, react-rnd, reveal.js 5.x (CDN), Tailwind CSS v4

**Spec:** `docs/superpowers/specs/2026-03-26-presentations-workstation-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `dashboard/src/stores/presentations-store.ts` | Zustand store with persist, session/outline/renderer state |
| `dashboard/src/components/skills/workstations/presentations/presentations-workstation.tsx` | Main container, left/right split layout |
| `dashboard/src/components/skills/workstations/presentations/presentations-source-panel.tsx` | Left panel: sources, renderer, theme, generate button |
| `dashboard/src/components/skills/workstations/presentations/outline-editor.tsx` | Slide thumbnail list + block editor |
| `dashboard/src/components/skills/workstations/presentations/slide-block-editor.tsx` | Single block edit UI (text/image/placeholder) |
| `dashboard/src/components/skills/workstations/presentations/renderer-picker.tsx` | Radio group: reveal.js / Canva / Felo |
| `dashboard/src/components/skills/workstations/presentations/slide-preview.tsx` | Right panel: iframe preview for reveal.js |
| `dashboard/src/components/skills/workstations/presentations/slide-thumbnail-list.tsx` | Sortable slide thumbnails with dnd-kit |
| `dashboard/src/components/skills/workstations/presentations/presentations-chat.tsx` | Chat refinement panel |
| `dashboard/src/components/skills/workstations/presentations/theme-picker.tsx` | Theme selection grid (24 themes) |
| `dashboard/src/app/api/presentations/generate/route.ts` | Claude CLI → SlideOutline JSON (SSE) |
| `dashboard/src/app/api/presentations/chat/route.ts` | Chat refinement (outline diff) |
| `dashboard/src/lib/presentations-utils.ts` | outlineToRevealHtml(), coordinate conversion |
| `dashboard/src/lib/presentation-themes.ts` | 24 theme definitions |
| `dashboard/src/components/skills/workstations/shared/source-list.tsx` | Refactored generic source list |
| `dashboard/src/components/skills/workstations/shared/source-picker-modal.tsx` | Refactored generic source picker |

### Modified Files
| File | Change |
|------|--------|
| `dashboard/src/config/skills-config.ts` | Add presentations workstation entry |
| `dashboard/src/components/skills/skills-panel.tsx` | Add presentations dispatch |
| `dashboard/src/components/skills/workstations/documents/documents-source-panel.tsx` | Import shared source components |
| `dashboard/src/components/skills/workstations/documents/source-list.tsx` | Redirect to shared (or keep as wrapper) |
| `dashboard/src/components/skills/workstations/documents/source-picker-modal.tsx` | Redirect to shared (or keep as wrapper) |
| `dashboard/package.json` | Add @dnd-kit/core, @dnd-kit/sortable, react-rnd |

---

## Task 1: Install Dependencies

**Files:**
- Modify: `dashboard/package.json`

- [ ] **Step 1: Install @dnd-kit and react-rnd**

```bash
cd /Users/username/CycloneOpenClaw/dashboard && npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities react-rnd
```

- [ ] **Step 2: Verify installation**

```bash
cd /Users/username/CycloneOpenClaw/dashboard && node -e "require('@dnd-kit/core'); require('react-rnd'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd /Users/username/CycloneOpenClaw && git add dashboard/package.json dashboard/package-lock.json && git commit -m "chore: add @dnd-kit and react-rnd dependencies for presentations workstation"
```

---

## Task 2: Refactor Source Components to Shared

Extract `source-list.tsx` and `source-picker-modal.tsx` from Documents-specific coupling into generic shared components that accept callback props.

**Files:**
- Create: `dashboard/src/components/skills/workstations/shared/source-list.tsx`
- Create: `dashboard/src/components/skills/workstations/shared/source-picker-modal.tsx`
- Modify: `dashboard/src/components/skills/workstations/documents/source-list.tsx`
- Modify: `dashboard/src/components/skills/workstations/documents/source-picker-modal.tsx`
- Modify: `dashboard/src/components/skills/workstations/documents/documents-source-panel.tsx`

- [ ] **Step 1: Create shared source-list.tsx**

Read existing `dashboard/src/components/skills/workstations/documents/source-list.tsx` (115 lines). Create a generic version at `shared/source-list.tsx` that:
- Replaces `useDocumentsStore` import (line 16) with callback props
- Props interface:
```typescript
interface SharedSourceListProps {
  sources: SourceItem[]
  onAddSources: (sources: SourceItem[]) => void
  onRemoveSource: (id: string) => void
}
```
- All existing UI logic stays identical (drag-drop, icons, remove buttons)
- **Important:** The `handleDrop` function (line 39 in original) must call `onAddSources` from props instead of from the store
- The "Add Source" button and SourcePickerModal rendering stay inside this component — pass `onAddSources` down to the modal
- Import `SourceItem` from `@/stores/documents-store` (type-only import)

- [ ] **Step 2: Create shared source-picker-modal.tsx**

Read existing `dashboard/src/components/skills/workstations/documents/source-picker-modal.tsx` (302 lines). Create a generic version at `shared/source-picker-modal.tsx` that:
- Replaces `useDocumentsStore` usage (line 48) with callback prop
- Props interface (note: use `open` not `isOpen` to match existing convention):
```typescript
interface SharedSourcePickerModalProps {
  open: boolean
  onClose: () => void
  onAddSources: (sources: SourceItem[]) => void
}
```
- All existing browse logic, tabs, UI stays identical
- `handleConfirm` calls `onAddSources` from props instead of from the store

- [ ] **Step 3: Update Documents source-list.tsx to use shared**

Replace the body of `documents/source-list.tsx` with a thin wrapper:
```typescript
"use client";
import { SharedSourceList } from "../shared/source-list";
import { useDocumentsStore } from "@/stores/documents-store";

export function SourceList() {
  const { currentSession, addSources, removeSource } = useDocumentsStore();
  return (
    <SharedSourceList
      sources={currentSession?.sources ?? []}
      onAddSources={addSources}
      onRemoveSource={removeSource}
    />
  );
}
```

- [ ] **Step 4: Update Documents source-picker-modal.tsx to use shared**

Replace the body of `documents/source-picker-modal.tsx` with a thin wrapper:
```typescript
"use client";
import { SharedSourcePickerModal } from "../shared/source-picker-modal";
import { useDocumentsStore } from "@/stores/documents-store";

interface SourcePickerModalProps {
  open: boolean;
  onClose: () => void;
}

export function SourcePickerModal({ open, onClose }: SourcePickerModalProps) {
  const { addSources } = useDocumentsStore();
  return (
    <SharedSourcePickerModal
      open={open}
      onClose={onClose}
      onAddSources={addSources}
    />
  );
}
```

- [ ] **Step 5: Update documents-source-panel.tsx imports**

Read `documents-source-panel.tsx`. Update any direct references to the old source-list/source-picker-modal to use the new wrappers. The wrapper files are in the same directory so import paths stay the same — this step is mainly to verify nothing broke.

- [ ] **Step 6: Verify Documents workstation still works**

```bash
cd /Users/username/CycloneOpenClaw/dashboard && npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 7: Commit**

```bash
cd /Users/username/CycloneOpenClaw && git add dashboard/src/components/skills/workstations/shared/ dashboard/src/components/skills/workstations/documents/source-list.tsx dashboard/src/components/skills/workstations/documents/source-picker-modal.tsx dashboard/src/components/skills/workstations/documents/documents-source-panel.tsx && git commit -m "refactor: extract shared source-list and source-picker-modal components

Decouple source selection components from useDocumentsStore to enable
reuse in Presentations workstation. Documents wrappers delegate to
shared components via callback props."
```

---

## Task 3: Create Presentation Themes Data

**Files:**
- Create: `dashboard/src/lib/presentation-themes.ts`

- [ ] **Step 1: Create theme definitions file**

```typescript
// dashboard/src/lib/presentation-themes.ts

export type ThemeCategory =
  | "consulting"
  | "startup"
  | "modern"
  | "minimal"
  | "data"
  | "education"
  | "asian"
  | "institutional"
  | "creative";

export interface PresentationTheme {
  id: string;
  name: string;
  nameZh: string;
  category: ThemeCategory;
  revealTheme: string;
  revealColors: { bg: string; text: string; accent: string; secondary?: string };
  revealFonts: { heading: string; body: string; mono?: string };
  canvaStylePrompt: string;
  feloThemeId?: string;
}

export const THEME_CATEGORIES: Record<ThemeCategory, string> = {
  consulting: "顧問商務",
  startup: "科技新創",
  modern: "現代設計",
  minimal: "極簡",
  data: "數據分析",
  education: "教育",
  asian: "日式/亞洲",
  institutional: "政府/機構",
  creative: "創意表現",
};

export const PRESENTATION_THEMES: PresentationTheme[] = [
  // Consulting & Corporate
  {
    id: "mckinsey",
    name: "McKinsey Classic",
    nameZh: "麥肯錫經典",
    category: "consulting",
    revealTheme: "white",
    revealColors: { bg: "#FFFFFF", text: "#333333", accent: "#003A70" },
    revealFonts: { heading: "Georgia, serif", body: "Arial, sans-serif" },
    canvaStylePrompt: "McKinsey-style clean corporate presentation with navy blue accents, action titles, generous white space, professional consulting layout",
  },
  {
    id: "bcg",
    name: "BCG Analytical",
    nameZh: "BCG 分析",
    category: "consulting",
    revealTheme: "white",
    revealColors: { bg: "#FFFFFF", text: "#2D2D2D", accent: "#00A651" },
    revealFonts: { heading: "Trebuchet MS, sans-serif", body: "Trebuchet MS, sans-serif" },
    canvaStylePrompt: "BCG-style data-heavy analytical presentation with green accents, charts and matrix diagrams, professional consulting format",
  },
  {
    id: "deloitte",
    name: "Deloitte Executive",
    nameZh: "Deloitte 行政",
    category: "consulting",
    revealTheme: "white",
    revealColors: { bg: "#FFFFFF", text: "#000000", accent: "#86BC25" },
    revealFonts: { heading: "Montserrat, sans-serif", body: "Open Sans, sans-serif" },
    canvaStylePrompt: "Deloitte-style executive presentation with green accents, headline-evidence-bumper structure, professional and balanced",
  },
  {
    id: "accenture",
    name: "Accenture Bold",
    nameZh: "Accenture 大膽",
    category: "consulting",
    revealTheme: "white",
    revealColors: { bg: "#FFFFFF", text: "#000000", accent: "#A100FF" },
    revealFonts: { heading: "Arial, sans-serif", body: "Arial, sans-serif" },
    canvaStylePrompt: "Accenture-style bold modern presentation with purple accents, dynamic layouts, technology-forward design",
  },
  // Tech & Startup
  {
    id: "yc-minimal",
    name: "YC Minimal",
    nameZh: "YC 極簡",
    category: "startup",
    revealTheme: "white",
    revealColors: { bg: "#FFFFFF", text: "#1A1A1A", accent: "#FF6600" },
    revealFonts: { heading: "Inter, sans-serif", body: "Inter, sans-serif" },
    canvaStylePrompt: "Y Combinator style minimal pitch deck, one idea per slide, large numbers for metrics, orange accent, extreme simplicity",
  },
  {
    id: "sequoia",
    name: "Sequoia Storyteller",
    nameZh: "紅杉敘事",
    category: "startup",
    revealTheme: "white",
    revealColors: { bg: "#FFFFFF", text: "#1C1C1C", accent: "#CC0000" },
    revealFonts: { heading: "Helvetica Neue, sans-serif", body: "Helvetica Neue, sans-serif" },
    canvaStylePrompt: "Sequoia Capital style narrative pitch deck, mission-driven, clean data visualization, red accent, storytelling format",
  },
  {
    id: "dark-tech",
    name: "Dark Tech",
    nameZh: "暗黑科技",
    category: "startup",
    revealTheme: "night",
    revealColors: { bg: "#0D0D0D", text: "#E8EDF4", accent: "#00D4FF", secondary: "#8B5CF6" },
    revealFonts: { heading: "Space Grotesk, sans-serif", body: "Inter, sans-serif", mono: "JetBrains Mono, monospace" },
    canvaStylePrompt: "Dark futuristic tech presentation with neon cyan and purple accents on black background, high contrast, developer-oriented",
  },
  // Modern Design
  {
    id: "glass",
    name: "Glassmorphism",
    nameZh: "玻璃擬態",
    category: "modern",
    revealTheme: "black",
    revealColors: { bg: "linear-gradient(135deg, #667eea, #764ba2)", text: "#FFFFFF", accent: "rgba(255,255,255,0.9)" },
    revealFonts: { heading: "Poppins, sans-serif", body: "Poppins, sans-serif" },
    canvaStylePrompt: "Glassmorphism style with frosted glass cards, vibrant gradient backgrounds, blur effects, premium modern tech feel",
  },
  {
    id: "bento",
    name: "Bento Grid",
    nameZh: "便當格局",
    category: "modern",
    revealTheme: "white",
    revealColors: { bg: "#F5F5F7", text: "#1D1D1F", accent: "#0071E3" },
    revealFonts: { heading: "Inter, sans-serif", body: "Inter, sans-serif" },
    canvaStylePrompt: "Apple-inspired Bento grid layout with modular rounded cards, clean typography, blue accent, product showcase style",
  },
  {
    id: "neobrutal",
    name: "Neobrutalism",
    nameZh: "新粗獷主義",
    category: "modern",
    revealTheme: "white",
    revealColors: { bg: "#FFFFFF", text: "#000000", accent: "#FFDE59", secondary: "#FF6B6B" },
    revealFonts: { heading: "Archivo Black, sans-serif", body: "Inter, sans-serif", mono: "Space Mono, monospace" },
    canvaStylePrompt: "Neobrutalist design with thick black borders, bold flat colors, hard drop shadows, quirky anti-design aesthetic",
  },
  {
    id: "editorial",
    name: "Editorial Magazine",
    nameZh: "編輯雜誌",
    category: "modern",
    revealTheme: "serif",
    revealColors: { bg: "#FAFAF9", text: "#1A1A1A", accent: "#B91C1C" },
    revealFonts: { heading: "Playfair Display, serif", body: "Source Serif Pro, serif" },
    canvaStylePrompt: "Magazine editorial style with serif typography, asymmetric grids, pull quotes, sophisticated print-inspired layout",
  },
  // Minimalist
  {
    id: "swiss",
    name: "Swiss Minimalist",
    nameZh: "瑞士極簡",
    category: "minimal",
    revealTheme: "white",
    revealColors: { bg: "#FFFFFF", text: "#000000", accent: "#FF0000" },
    revealFonts: { heading: "Helvetica Neue, sans-serif", body: "Helvetica Neue, sans-serif" },
    canvaStylePrompt: "Swiss International Typographic Style, strict grid, extreme clarity, sans-serif only, red accent, mathematical precision",
  },
  {
    id: "soft",
    name: "Soft Minimal",
    nameZh: "柔和極簡",
    category: "minimal",
    revealTheme: "white",
    revealColors: { bg: "#FDF6F0", text: "#2D2D2D", accent: "#94A3B8", secondary: "#F0ABFC" },
    revealFonts: { heading: "DM Sans, sans-serif", body: "Nunito, sans-serif" },
    canvaStylePrompt: "Soft warm minimalism with pastel tones, rounded shapes, warm white background, calm and approachable",
  },
  {
    id: "mono-bold",
    name: "Monochrome Bold",
    nameZh: "單色大字",
    category: "minimal",
    revealTheme: "black",
    revealColors: { bg: "#000000", text: "#FFFFFF", accent: "#FF3D00" },
    revealFonts: { heading: "Bebas Neue, sans-serif", body: "Inter, sans-serif" },
    canvaStylePrompt: "Monochrome bold typography presentation, massive headings, black and white with single accent color, TED-talk style",
  },
  // Data & Analytics
  {
    id: "dashboard",
    name: "Dashboard Analyst",
    nameZh: "儀表板分析",
    category: "data",
    revealTheme: "night",
    revealColors: { bg: "#1E293B", text: "#FFFFFF", accent: "#3B82F6", secondary: "#10B981" },
    revealFonts: { heading: "Roboto, sans-serif", body: "Roboto, sans-serif", mono: "Roboto Mono, monospace" },
    canvaStylePrompt: "Dark dashboard analytics style with KPI cards, multiple chart types, traffic-light indicators, data-dense professional layout",
  },
  {
    id: "infographic",
    name: "Infographic Story",
    nameZh: "資訊圖表故事",
    category: "data",
    revealTheme: "white",
    revealColors: { bg: "#FFFFFF", text: "#1A1A1A", accent: "#2563EB", secondary: "#7C3AED" },
    revealFonts: { heading: "Poppins, sans-serif", body: "Open Sans, sans-serif" },
    canvaStylePrompt: "Infographic storytelling with icon-driven data, process flows, large statistics, vibrant but coordinated color palette",
  },
  // Education
  {
    id: "academic",
    name: "Academic Formal",
    nameZh: "學術正式",
    category: "education",
    revealTheme: "white",
    revealColors: { bg: "#FFFFFF", text: "#1A1A1A", accent: "#1E3A5F", secondary: "#C41E3A" },
    revealFonts: { heading: "Source Serif Pro, serif", body: "Calibri, sans-serif" },
    canvaStylePrompt: "Academic formal style with assertion-evidence format, consistent template, citation footnotes, conference presentation format",
  },
  {
    id: "classroom",
    name: "Classroom Friendly",
    nameZh: "教室親和",
    category: "education",
    revealTheme: "white",
    revealColors: { bg: "#FFF7ED", text: "#1E40AF", accent: "#DC2626", secondary: "#16A34A" },
    revealFonts: { heading: "Nunito, sans-serif", body: "DM Sans, sans-serif" },
    canvaStylePrompt: "Classroom-friendly educational style with large fonts, high contrast, chunky icons, section color-coding, warm and engaging",
  },
  // Japanese / Asian
  {
    id: "takahashi",
    name: "Takahashi Method",
    nameZh: "高橋流",
    category: "asian",
    revealTheme: "white",
    revealColors: { bg: "#FFFFFF", text: "#000000", accent: "#C41E3A" },
    revealFonts: { heading: "Noto Sans TC, sans-serif", body: "Inter, sans-serif" },
    canvaStylePrompt: "Takahashi method with giant text, one idea per slide, extreme simplicity, black on white, rapid-fire presentation style",
  },
  {
    id: "zen",
    name: "Zen Harmony",
    nameZh: "禪意和風",
    category: "asian",
    revealTheme: "serif",
    revealColors: { bg: "#F5F0EB", text: "#3D3D3D", accent: "#8B7355", secondary: "#6B8E6B" },
    revealFonts: { heading: "Noto Serif TC, serif", body: "Noto Sans TC, sans-serif" },
    canvaStylePrompt: "Zen harmony wabi-sabi inspired with muted earth tones, generous negative space, nature imagery, calming meditative feel",
  },
  // Government / Institutional
  {
    id: "gov-official",
    name: "Government Official",
    nameZh: "政府公務",
    category: "institutional",
    revealTheme: "white",
    revealColors: { bg: "#FFFFFF", text: "#1A1A1A", accent: "#003366", secondary: "#006633" },
    revealFonts: { heading: "Noto Sans TC, sans-serif", body: "Noto Sans TC, sans-serif" },
    canvaStylePrompt: "Government official presentation style, formal structured layout, blue header, traffic-light status indicators, conservative authoritative",
  },
  {
    id: "institutional",
    name: "Institutional Trust",
    nameZh: "機構信賴",
    category: "institutional",
    revealTheme: "white",
    revealColors: { bg: "#FFFFFF", text: "#1A1A1A", accent: "#1B365D", secondary: "#B8860B" },
    revealFonts: { heading: "Merriweather, serif", body: "Open Sans, sans-serif" },
    canvaStylePrompt: "Institutional trust style with understated professionalism, navy and gold accents, structured grids, conservative typography",
  },
  // Creative
  {
    id: "aurora",
    name: "Gradient Aurora",
    nameZh: "極光漸層",
    category: "creative",
    revealTheme: "black",
    revealColors: { bg: "linear-gradient(135deg, #667eea, #764ba2, #f093fb)", text: "#FFFFFF", accent: "#FFFFFF" },
    revealFonts: { heading: "Outfit, sans-serif", body: "Sora, sans-serif" },
    canvaStylePrompt: "Aurora gradient style with vivid shifting gradient backgrounds, white text, floating elements, dreamy immersive atmosphere",
  },
  {
    id: "noir",
    name: "Premium Noir",
    nameZh: "尊爵黑金",
    category: "creative",
    revealTheme: "black",
    revealColors: { bg: "#0A0A0A", text: "#FFFFFF", accent: "#D4AF37" },
    revealFonts: { heading: "Cormorant Garamond, serif", body: "Montserrat, sans-serif" },
    canvaStylePrompt: "Premium noir luxury style with black background, gold metallic accents, elegant thin borders, dramatic and exclusive",
  },
];

export function getThemeById(id: string): PresentationTheme | undefined {
  return PRESENTATION_THEMES.find((t) => t.id === id);
}

export function getThemesByCategory(category: ThemeCategory): PresentationTheme[] {
  return PRESENTATION_THEMES.filter((t) => t.category === category);
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/username/CycloneOpenClaw && git add dashboard/src/lib/presentation-themes.ts && git commit -m "feat(presentations): add 24 built-in theme definitions

Consulting, startup, modern, minimal, data, education, Asian,
institutional, and creative categories with reveal.js colors/fonts
and Canva style prompts."
```

---

## Task 4: Create Presentations Store

**Files:**
- Create: `dashboard/src/stores/presentations-store.ts`

Reference: `dashboard/src/stores/documents-store.ts` for Zustand pattern.

- [ ] **Step 1: Create the store**

```typescript
// dashboard/src/stores/presentations-store.ts

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { SourceItem } from "./documents-store";

// --- Types ---

export type SlideLayout = "title" | "content" | "two-column" | "image-full" | "blank";
export type RendererType = "revealjs" | "canva" | "felo";
export type SessionStatus = "configuring" | "generating" | "editing" | "exporting";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  targetSlideId?: string;
}

export type SlideBlock = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
} & (
  | { type: "heading"; content: string; level: 1 | 2 | 3 }
  | { type: "text"; content: string }
  | { type: "list"; items: string[] }
  | { type: "image"; src: string; alt: string }
  | { type: "placeholder"; prompt: string; generatedSrc?: string }
);

export interface SlideDefinition {
  id: string;
  order: number;
  layout: SlideLayout;
  blocks: SlideBlock[];
}

export interface SlideOutline {
  title: string;
  theme?: string;
  slides: SlideDefinition[];
}

export type RendererState =
  | { type: "revealjs"; html?: string }
  | { type: "canva"; designId?: string; transactionId?: string; elementMap?: Record<string, string>; pageDimensions?: { width: number; height: number } }
  | { type: "felo"; taskId?: string; pptUrl?: string; theme?: string };

export interface PresentationSession {
  id: string;
  name: string;
  status: SessionStatus;
  sources: SourceItem[];
  outline: SlideOutline;
  renderer: RendererType;
  rendererState: RendererState;
  chatHistory: ChatMessage[];
  aspectRatio: "16:9" | "4:3";
  selectedSlideId: string | null;
  claudeSessionId?: string;
  createdAt: number;
}

// --- Store ---

interface PresentationsState {
  sessions: PresentationSession[];
  activeSessionId: string | null;
  error: string | null;

  // Getters
  getActiveSession: () => PresentationSession | undefined;

  // Session management
  createSession: (name: string) => string;
  deleteSession: (id: string) => void;
  setActiveSession: (id: string | null) => void;
  setStatus: (status: SessionStatus) => void;
  setError: (error: string | null) => void;

  // Sources
  addSources: (sources: SourceItem[]) => void;
  removeSource: (id: string) => void;

  // Outline
  setOutline: (outline: SlideOutline) => void;
  updateSlide: (slideId: string, updates: Partial<Omit<SlideDefinition, "id">>) => void;
  updateBlock: (slideId: string, blockId: string, updates: Partial<SlideBlock>) => void;
  reorderSlides: (orderedIds: string[]) => void;
  addSlide: (layout: SlideLayout, afterSlideId?: string) => void;
  deleteSlide: (slideId: string) => void;
  setSelectedSlide: (slideId: string | null) => void;

  // Renderer
  setRenderer: (renderer: RendererType) => void;
  setRendererState: (state: RendererState) => void;
  setAspectRatio: (ratio: "16:9" | "4:3") => void;

  // Chat
  addChatMessage: (msg: Omit<ChatMessage, "id" | "timestamp">) => void;
  setClaudeSessionId: (id: string) => void;

  // Image
  setBlockImage: (slideId: string, blockId: string, src: string) => void;
}

function generateId(): string {
  return crypto.randomUUID();
}

function updateSession(
  sessions: PresentationSession[],
  activeId: string | null,
  updater: (session: PresentationSession) => PresentationSession
): PresentationSession[] {
  if (!activeId) return sessions;
  return sessions.map((s) => (s.id === activeId ? updater(s) : s));
}

export const usePresentationsStore = create<PresentationsState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,
      error: null,

      getActiveSession: () => {
        const { sessions, activeSessionId } = get();
        return sessions.find((s) => s.id === activeSessionId);
      },

      createSession: (name) => {
        const id = generateId();
        const session: PresentationSession = {
          id,
          name,
          status: "configuring",
          sources: [],
          outline: { title: "", slides: [] },
          renderer: "revealjs",
          rendererState: { type: "revealjs" },
          chatHistory: [],
          aspectRatio: "16:9",
          selectedSlideId: null,
          createdAt: Date.now(),
        };
        set((state) => ({
          sessions: [...state.sessions, session],
          activeSessionId: id,
          error: null,
        }));
        return id;
      },

      deleteSession: (id) =>
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== id),
          activeSessionId: state.activeSessionId === id ? null : state.activeSessionId,
        })),

      setActiveSession: (id) => set({ activeSessionId: id, error: null }),

      setStatus: (status) =>
        set((state) => ({
          sessions: updateSession(state.sessions, state.activeSessionId, (s) => ({ ...s, status })),
        })),

      setError: (error) => set({ error }),

      addSources: (sources) =>
        set((state) => ({
          sessions: updateSession(state.sessions, state.activeSessionId, (s) => ({
            ...s,
            sources: [...s.sources, ...sources],
          })),
        })),

      removeSource: (id) =>
        set((state) => ({
          sessions: updateSession(state.sessions, state.activeSessionId, (s) => ({
            ...s,
            sources: s.sources.filter((src) => src.id !== id),
          })),
        })),

      setOutline: (outline) =>
        set((state) => ({
          sessions: updateSession(state.sessions, state.activeSessionId, (s) => ({
            ...s,
            outline,
            status: "editing",
            selectedSlideId: outline.slides[0]?.id ?? null,
          })),
        })),

      updateSlide: (slideId, updates) =>
        set((state) => ({
          sessions: updateSession(state.sessions, state.activeSessionId, (s) => ({
            ...s,
            outline: {
              ...s.outline,
              slides: s.outline.slides.map((sl) =>
                sl.id === slideId ? { ...sl, ...updates } : sl
              ),
            },
          })),
        })),

      updateBlock: (slideId, blockId, updates) =>
        set((state) => ({
          sessions: updateSession(state.sessions, state.activeSessionId, (s) => ({
            ...s,
            outline: {
              ...s.outline,
              slides: s.outline.slides.map((sl) =>
                sl.id === slideId
                  ? {
                      ...sl,
                      blocks: sl.blocks.map((b) =>
                        b.id === blockId ? { ...b, ...updates } : b
                      ),
                    }
                  : sl
              ),
            },
          })),
        })),

      reorderSlides: (orderedIds) =>
        set((state) => ({
          sessions: updateSession(state.sessions, state.activeSessionId, (s) => {
            const slideMap = new Map(s.outline.slides.map((sl) => [sl.id, sl]));
            const reordered = orderedIds
              .map((id, i) => {
                const slide = slideMap.get(id);
                return slide ? { ...slide, order: i } : null;
              })
              .filter(Boolean) as SlideDefinition[];
            return { ...s, outline: { ...s.outline, slides: reordered } };
          }),
        })),

      addSlide: (layout, afterSlideId) =>
        set((state) => ({
          sessions: updateSession(state.sessions, state.activeSessionId, (s) => {
            const newSlide: SlideDefinition = {
              id: generateId(),
              order: s.outline.slides.length,
              layout,
              blocks: [],
            };
            const slides = [...s.outline.slides];
            if (afterSlideId) {
              const idx = slides.findIndex((sl) => sl.id === afterSlideId);
              slides.splice(idx + 1, 0, newSlide);
            } else {
              slides.push(newSlide);
            }
            // Re-number order
            slides.forEach((sl, i) => (sl.order = i));
            return {
              ...s,
              outline: { ...s.outline, slides },
              selectedSlideId: newSlide.id,
            };
          }),
        })),

      deleteSlide: (slideId) =>
        set((state) => ({
          sessions: updateSession(state.sessions, state.activeSessionId, (s) => {
            const slides = s.outline.slides.filter((sl) => sl.id !== slideId);
            slides.forEach((sl, i) => (sl.order = i));
            return {
              ...s,
              outline: { ...s.outline, slides },
              selectedSlideId:
                s.selectedSlideId === slideId ? (slides[0]?.id ?? null) : s.selectedSlideId,
            };
          }),
        })),

      setSelectedSlide: (slideId) =>
        set((state) => ({
          sessions: updateSession(state.sessions, state.activeSessionId, (s) => ({
            ...s,
            selectedSlideId: slideId,
          })),
        })),

      setRenderer: (renderer) =>
        set((state) => ({
          sessions: updateSession(state.sessions, state.activeSessionId, (s) => ({
            ...s,
            renderer,
            rendererState: { type: renderer } as RendererState,
          })),
        })),

      setRendererState: (rendererState) =>
        set((state) => ({
          sessions: updateSession(state.sessions, state.activeSessionId, (s) => ({
            ...s,
            rendererState,
          })),
        })),

      setAspectRatio: (aspectRatio) =>
        set((state) => ({
          sessions: updateSession(state.sessions, state.activeSessionId, (s) => ({
            ...s,
            aspectRatio,
          })),
        })),

      addChatMessage: (msg) =>
        set((state) => ({
          sessions: updateSession(state.sessions, state.activeSessionId, (s) => ({
            ...s,
            chatHistory: [
              ...s.chatHistory,
              { ...msg, id: generateId(), timestamp: Date.now() },
            ],
          })),
        })),

      setClaudeSessionId: (claudeSessionId) =>
        set((state) => ({
          sessions: updateSession(state.sessions, state.activeSessionId, (s) => ({
            ...s,
            claudeSessionId,
          })),
        })),

      setBlockImage: (slideId, blockId, src) =>
        set((state) => ({
          sessions: updateSession(state.sessions, state.activeSessionId, (s) => ({
            ...s,
            outline: {
              ...s.outline,
              slides: s.outline.slides.map((sl) =>
                sl.id === slideId
                  ? {
                      ...sl,
                      blocks: sl.blocks.map((b) =>
                        b.id === blockId && b.type === "placeholder"
                          ? { ...b, generatedSrc: src }
                          : b
                      ),
                    }
                  : sl
              ),
            },
          })),
        })),
    }),
    {
      name: "presentations-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ sessions: state.sessions }),
    }
  )
);
```

- [ ] **Step 2: Verify store compiles**

```bash
cd /Users/username/CycloneOpenClaw/dashboard && npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: No errors related to presentations-store.ts

- [ ] **Step 3: Commit**

```bash
cd /Users/username/CycloneOpenClaw && git add dashboard/src/stores/presentations-store.ts && git commit -m "feat(presentations): add Zustand store with persist

Multi-session store with outline editing, renderer management,
chat history, and localStorage persistence."
```

---

## Task 5: Create presentations-utils.ts (outlineToRevealHtml)

**Files:**
- Create: `dashboard/src/lib/presentations-utils.ts`

Reference: `dashboard/src/app/api/documents/process/route.ts` lines 29-75 for `markdownToRevealHtml()`.

- [ ] **Step 1: Create the utility file**

```typescript
// dashboard/src/lib/presentations-utils.ts

import type { SlideOutline, SlideBlock, SlideDefinition } from "@/stores/presentations-store";
import { getThemeById } from "./presentation-themes";

/**
 * Convert percentage-based block coordinates to CSS absolute positioning.
 */
function blockToCSS(block: SlideBlock): string {
  return `position:absolute;left:${block.x}%;top:${block.y}%;width:${block.width}%;height:${block.height}%;`;
}

/**
 * Render a single block to HTML.
 */
function blockToHtml(block: SlideBlock): string {
  const style = blockToCSS(block);

  switch (block.type) {
    case "heading":
      const tag = `h${block.level}`;
      return `<${tag} style="${style}" data-block-id="${block.id}">${escapeHtml(block.content)}</${tag}>`;

    case "text":
      return `<p style="${style}" data-block-id="${block.id}">${escapeHtml(block.content)}</p>`;

    case "list":
      const items = block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n");
      return `<ul style="${style}" data-block-id="${block.id}">\n${items}\n</ul>`;

    case "image":
      return `<img src="${escapeHtml(block.src)}" alt="${escapeHtml(block.alt)}" style="${style}object-fit:contain;" data-block-id="${block.id}" />`;

    case "placeholder":
      if (block.generatedSrc) {
        return `<img src="${escapeHtml(block.generatedSrc)}" alt="Generated image" style="${style}object-fit:contain;" data-block-id="${block.id}" />`;
      }
      return `<div style="${style}border:2px dashed #666;display:flex;align-items:center;justify-content:center;color:#888;font-size:14px;padding:8px;text-align:center;" data-block-id="${block.id}">${escapeHtml(block.prompt)}</div>`;

    default:
      return "";
  }
}

/**
 * Render a single slide to HTML.
 */
function slideToHtml(slide: SlideDefinition): string {
  const blocksHtml = slide.blocks.map(blockToHtml).join("\n    ");
  return `  <section data-slide-id="${slide.id}" style="position:relative;width:100%;height:100%;">
    ${blocksHtml}
  </section>`;
}

/**
 * Convert SlideOutline JSON to a complete reveal.js HTML document.
 */
export function outlineToRevealHtml(
  outline: SlideOutline,
  aspectRatio: "16:9" | "4:3" = "16:9"
): string {
  const theme = outline.theme ? getThemeById(outline.theme) : undefined;
  const revealTheme = theme?.revealTheme ?? "white";
  const colors = theme?.revealColors ?? { bg: "#FFFFFF", text: "#1A1A1A", accent: "#003A70" };
  const fonts = theme?.revealFonts ?? { heading: "Inter, sans-serif", body: "Inter, sans-serif" };

  const [w, h] = aspectRatio === "16:9" ? [960, 540] : [960, 720];

  const slidesHtml = outline.slides
    .sort((a, b) => a.order - b.order)
    .map(slideToHtml)
    .join("\n");

  const bgStyle = colors.bg.startsWith("linear-gradient")
    ? `background: ${colors.bg};`
    : `background-color: ${colors.bg};`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(outline.title)}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5/dist/reveal.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5/dist/theme/${revealTheme}.css">
  <style>
    :root {
      --r-background-color: ${colors.bg.startsWith("linear") ? "#000" : colors.bg};
      --r-main-color: ${colors.text};
      --r-heading-color: ${colors.accent};
      --r-heading-font: ${fonts.heading};
      --r-main-font: ${fonts.body};
    }
    .reveal .slides { ${bgStyle} }
    .reveal .slides section { ${bgStyle} color: ${colors.text}; }
    .reveal h1, .reveal h2, .reveal h3 { color: ${colors.accent}; font-family: ${fonts.heading}; }
    .reveal p, .reveal li { font-family: ${fonts.body}; }
  </style>
</head>
<body>
  <div class="reveal">
    <div class="slides">
${slidesHtml}
    </div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/reveal.js@5/dist/reveal.js"><\/script>
  <script>
    Reveal.initialize({
      width: ${w},
      height: ${h},
      hash: true,
      transition: 'slide'
    });
  <\/script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/username/CycloneOpenClaw && git add dashboard/src/lib/presentations-utils.ts && git commit -m "feat(presentations): add outlineToRevealHtml utility

Converts SlideOutline JSON to reveal.js HTML with percentage-based
absolute positioning, theme support, and placeholder rendering."
```

---

## Task 6: Create Generate API Route

**Files:**
- Create: `dashboard/src/app/api/presentations/generate/route.ts`

Reference: `dashboard/src/app/api/documents/process/route.ts` lines 142-306 for Claude CLI spawn + SSE pattern.

- [ ] **Step 1: Create the API route**

Read `dashboard/src/app/api/documents/process/route.ts` for the exact spawn pattern (lines 142-306). Create `generate/route.ts` following the same pattern:

**Critical implementation notes:**
1. Must export `runtime = "nodejs"` and `dynamic = "force-dynamic"` (required for `spawn`)
2. Must use the `lineBuffer` pattern from Documents route (lines 178-217) to handle JSON split across chunks
3. Must use `cleanClaudeOutput` from `@/lib/documents-utils` to strip context footers and fence markers
4. Must parse accumulated output as JSON after stripping markdown fences (Claude may wrap in ```json)

```typescript
// dashboard/src/app/api/presentations/generate/route.ts
import { spawn } from "child_process";
import { cleanClaudeOutput } from "@/lib/documents-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SLIDE_OUTLINE_PROMPT = (
  filePaths: string[],
  aspectRatio: string,
  instructions: string
) => `You are a presentation outline generator.

${filePaths.length > 0 ? `Read these source files and analyze their content:
${filePaths.map((p) => `- ${p}`).join("\n")}` : ""}

${instructions ? `User instructions: ${instructions}` : "Create a professional presentation."}

Generate a SlideOutline JSON object with this EXACT structure:
{
  "title": "Presentation Title",
  "slides": [
    {
      "id": "<uuid>",
      "order": 0,
      "layout": "title" | "content" | "two-column" | "image-full" | "blank",
      "blocks": [
        {
          "id": "<uuid>",
          "type": "heading" | "text" | "list" | "image" | "placeholder",
          "x": 5,     // percentage 0-100, left position
          "y": 10,    // percentage 0-100, top position
          "width": 90, // percentage 0-100
          "height": 20, // percentage 0-100
          // For heading: "content": "...", "level": 1|2|3
          // For text: "content": "..."
          // For list: "items": ["item1", "item2"]
          // For placeholder: "prompt": "description of image to generate"
        }
      ]
    }
  ]
}

Aspect ratio: ${aspectRatio}. Position blocks to fit well within this ratio.
Generate unique UUIDs for all id fields.
Output ONLY the raw JSON. No markdown fences. No explanation. No other text.
Do NOT write any files.`;

export async function POST(request: Request) {
  const { sources = [], aspectRatio = "16:9", instructions = "", theme } = await request.json();

  const filePaths = sources.map((s: { path: string }) => s.path);
  const prompt = SLIDE_OUTLINE_PROMPT(filePaths, aspectRatio, instructions);

  const args = [
    "--print",
    "--verbose",
    "--output-format", "stream-json",
    "--model", "sonnet",
    "--strict-mcp-config",
    "--setting-sources", "",
    "--disallowed-tools", "Write,Edit",
  ];

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      const child = spawn("claude", args, {
        stdio: ["pipe", "pipe", "pipe"],
      });

      child.stdin.write(prompt);
      child.stdin.end();

      let accumulated = "";
      let lineBuffer = "";
      let sessionId = "";

      const processLine = (line: string) => {
        if (!line.trim()) return;
        try {
          const parsed = JSON.parse(line);
          if (parsed.type === "system" && parsed.session_id) {
            sessionId = parsed.session_id;
            send("session", { sessionId });
          } else if (parsed.type === "content_block_delta" || parsed.type === "assistant") {
            const text = parsed.content_block?.text || parsed.message?.content?.[0]?.text || "";
            if (text) {
              accumulated += text;
              send("text", { text });
            }
          }
        } catch {
          // Not valid JSON yet, skip
        }
      };

      child.stdout.on("data", (chunk: Buffer) => {
        const str = chunk.toString();
        lineBuffer += str;
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop() ?? "";
        for (const line of lines) {
          processLine(line);
        }
      });

      child.stderr.on("data", (chunk: Buffer) => {
        const msg = chunk.toString().trim();
        if (msg) send("error", { message: msg });
      });

      child.on("close", (code) => {
        // Process remaining buffer
        if (lineBuffer.trim()) processLine(lineBuffer);

        if (code !== 0 && !accumulated) {
          send("error", { message: `Claude exited with code ${code}` });
          send("done", {});
          controller.close();
          return;
        }

        // Parse the accumulated text as SlideOutline JSON
        try {
          const cleaned = cleanClaudeOutput(accumulated);
          // Strip markdown JSON fences if present
          const jsonStr = cleaned
            .replace(/^```(?:json)?\s*\n?/m, "")
            .replace(/\n?```\s*$/m, "")
            .trim();
          const outline = JSON.parse(jsonStr);
          send("outline", { outline, sessionId });
        } catch (e) {
          send("error", { message: `Failed to parse outline JSON: ${e}` });
        }

        send("done", {});
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

- [ ] **Step 2: Test the route manually**

```bash
curl -X POST http://localhost:3000/api/presentations/generate \
  -H "Content-Type: application/json" \
  -d '{"sources": [], "aspectRatio": "16:9", "instructions": "Create a 3-slide presentation about AI in education"}' \
  --no-buffer 2>&1 | head -50
```

Expected: SSE stream with `event: text` and eventually `event: outline` containing valid JSON.

- [ ] **Step 3: Commit**

```bash
cd /Users/username/CycloneOpenClaw && git add dashboard/src/app/api/presentations/generate/ && git commit -m "feat(presentations): add generate API route

Claude CLI spawns to analyze sources and produce SlideOutline JSON
via SSE streaming. Same spawn pattern as Documents workstation."
```

---

## Task 7: Create Core UI Components

**Files:**
- Create: `dashboard/src/components/skills/workstations/presentations/renderer-picker.tsx`
- Create: `dashboard/src/components/skills/workstations/presentations/theme-picker.tsx`
- Create: `dashboard/src/components/skills/workstations/presentations/slide-preview.tsx`
- Create: `dashboard/src/components/skills/workstations/presentations/slide-thumbnail-list.tsx`
- Create: `dashboard/src/components/skills/workstations/presentations/slide-block-editor.tsx`
- Create: `dashboard/src/components/skills/workstations/presentations/outline-editor.tsx`

These are all pure UI components. Build them in dependency order (leaf components first).

- [ ] **Step 1: Create renderer-picker.tsx**

Simple radio group for selecting reveal.js / Canva (disabled) / Felo (disabled).

```typescript
"use client";
import { Monitor, Palette, FileText } from "lucide-react";
import { usePresentationsStore, type RendererType } from "@/stores/presentations-store";

const RENDERERS: { id: RendererType; name: string; icon: typeof Monitor; enabled: boolean; description: string }[] = [
  { id: "revealjs", name: "reveal.js", icon: Monitor, enabled: true, description: "即時預覽、HTML 匯出" },
  { id: "canva", name: "Canva", icon: Palette, enabled: false, description: "精美設計（即將推出）" },
  { id: "felo", name: "Felo PPT", icon: FileText, enabled: false, description: "快速 PPT（即將推出）" },
];

export function RendererPicker() {
  const { getActiveSession, setRenderer } = usePresentationsStore();
  const session = getActiveSession();
  const current = session?.renderer ?? "revealjs";

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-cy-muted">輸出引擎</label>
      <div className="space-y-1">
        {RENDERERS.map(({ id, name, icon: Icon, enabled, description }) => (
          <button
            key={id}
            onClick={() => enabled && setRenderer(id)}
            disabled={!enabled}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              current === id
                ? "bg-cy-accent/15 text-cy-accent border border-cy-accent/30"
                : enabled
                ? "bg-cy-input/50 text-cy-text hover:bg-cy-input border border-transparent"
                : "bg-cy-input/20 text-cy-muted/50 cursor-not-allowed border border-transparent"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <div className="text-left">
              <div className="font-medium">{name}</div>
              <div className="text-xs text-cy-muted">{description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create theme-picker.tsx**

Grid of theme cards grouped by category. Shows name + accent color swatch.

Read `dashboard/src/lib/presentation-themes.ts` for theme data. Create a component that:
- Groups themes by category using `THEME_CATEGORIES`
- Each theme is a small clickable card with color swatch + name
- Selected theme has accent border
- Custom theme option at the end (text input, disabled for now)
- Calls `setOutline({ ...outline, theme: themeId })` on selection

- [ ] **Step 3: Create slide-preview.tsx**

iframe-based reveal.js preview. Key implementation:
- Takes the current session's outline + aspectRatio
- Calls `outlineToRevealHtml()` to get HTML string
- Renders in an iframe via `srcdoc` attribute
- Maintains aspect ratio with CSS (16:9 or 4:3 container)
- Shows empty state when no outline exists

```typescript
"use client";
import { usePresentationsStore } from "@/stores/presentations-store";
import { outlineToRevealHtml } from "@/lib/presentations-utils";

export function SlidePreview() {
  const { getActiveSession } = usePresentationsStore();
  const session = getActiveSession();

  if (!session || session.outline.slides.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-cy-muted text-sm">
        生成大綱後會在此顯示預覽
      </div>
    );
  }

  const html = outlineToRevealHtml(session.outline, session.aspectRatio);
  const aspectClass = session.aspectRatio === "16:9" ? "aspect-video" : "aspect-[4/3]";

  return (
    <div className="flex items-center justify-center h-full p-4">
      <div className={`${aspectClass} w-full max-h-full bg-black rounded-lg overflow-hidden shadow-lg`}>
        <iframe
          srcDoc={html}
          className="w-full h-full border-0"
          sandbox="allow-scripts"
          title="Slide Preview"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create slide-thumbnail-list.tsx**

Sortable vertical list of slide thumbnails using @dnd-kit/sortable. Key dnd-kit skeleton:

```typescript
"use client";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus } from "lucide-react";
import { usePresentationsStore } from "@/stores/presentations-store";

function SortableSlide({ slide, index, isSelected }: { slide: SlideDefinition; index: number; isSelected: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: slide.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const { setSelectedSlide } = usePresentationsStore();
  const title = slide.blocks.find((b) => b.type === "heading")?.content ?? `投影片 ${index + 1}`;

  return (
    <div ref={setNodeRef} style={style} onClick={() => setSelectedSlide(slide.id)}
      className={`flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
        isSelected ? "bg-cy-accent/15 border border-cy-accent/30" : "bg-cy-input/30 border border-transparent hover:bg-cy-input/50"
      }`}
    >
      <button {...attributes} {...listeners} className="cursor-grab text-cy-muted hover:text-cy-text">
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span className="text-xs text-cy-muted w-5">{index + 1}</span>
      <span className="truncate text-cy-text">{title}</span>
    </div>
  );
}

export function SlideThumbnailList() {
  const { getActiveSession, reorderSlides, addSlide } = usePresentationsStore();
  const session = getActiveSession();
  const slides = session?.outline.slides ?? [];
  const selectedId = session?.selectedSlideId;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = slides.findIndex((s) => s.id === active.id);
      const newIndex = slides.findIndex((s) => s.id === over.id);
      const newOrder = arrayMove(slides.map((s) => s.id), oldIndex, newIndex);
      reorderSlides(newOrder);
    }
  };

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-cy-muted">投影片</label>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={slides.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {slides.map((slide, i) => (
              <SortableSlide key={slide.id} slide={slide} index={i} isSelected={slide.id === selectedId} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <button onClick={() => addSlide("content")}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-cy-muted hover:text-cy-accent rounded-lg border border-dashed border-cy-border hover:border-cy-accent/30 transition-colors"
      >
        <Plus className="h-3 w-3" /> 新增投影片
      </button>
    </div>
  );
}
```

Add missing import at top: `import type { SlideDefinition } from "@/stores/presentations-store";`

- [ ] **Step 5: Create slide-block-editor.tsx**

Expandable list item for editing a single block. Handles each block type:
- `heading`: text input + level selector (H1/H2/H3)
- `text`: textarea
- `list`: textarea with one item per line
- `image`: URL input + alt text
- `placeholder`: prompt textarea + "Generate Image" button (disabled for now)
- Delete button on each block
- Calls store's `updateBlock()` on changes

- [ ] **Step 6: Create outline-editor.tsx**

Combines slide-thumbnail-list + slide-block-editor. Layout:
- Top: horizontal scrollable thumbnail strip
- Bottom: block editor for the selected slide
- "Add Slide" button with layout dropdown
- Layout selector for current slide

- [ ] **Step 7: Verify all components compile**

```bash
cd /Users/username/CycloneOpenClaw/dashboard && npx tsc --noEmit --pretty 2>&1 | head -30
```

Expected: No type errors.

- [ ] **Step 8: Commit**

```bash
cd /Users/username/CycloneOpenClaw && git add dashboard/src/components/skills/workstations/presentations/ && git commit -m "feat(presentations): add core UI components

renderer-picker, theme-picker, slide-preview (iframe reveal.js),
slide-thumbnail-list (dnd-kit sortable), slide-block-editor,
and outline-editor."
```

---

## Task 8: Create Source Panel and Main Workstation

**Files:**
- Create: `dashboard/src/components/skills/workstations/presentations/presentations-source-panel.tsx`
- Create: `dashboard/src/components/skills/workstations/presentations/presentations-chat.tsx`
- Create: `dashboard/src/components/skills/workstations/presentations/presentations-workstation.tsx`

- [ ] **Step 1: Create presentations-source-panel.tsx**

Left panel that combines:
- Source list (using shared source-list component)
- Source picker modal trigger
- Renderer picker
- Theme picker (collapsible)
- Aspect ratio toggle (16:9 / 4:3)
- "Generate Outline" button that POSTs to `/api/presentations/generate`

The generate button handler follows the same SSE pattern as `documents-source-panel.tsx` lines 29-79:
- Fetch with ReadableStream reader
- Parse SSE events
- On `outline` event: call `setOutline()` with parsed JSON
- On `session` event: call `setClaudeSessionId()`
- On `error` event: call `setError()`

When status is `editing` (outline exists), replace "Generate" with outline-editor component.

- [ ] **Step 2: Create presentations-chat.tsx**

Chat panel for refinement. Read `documents-chat.tsx` (237 lines) and adapt:
- Same message list + input pattern
- Send messages to `/api/presentations/chat` (to be built in Phase P5, for now show "即將推出" placeholder)
- Message rendering with markdown (react-markdown + remark-gfm)
- Show `targetSlideId` context in messages

For Phase P1, just build the UI shell with the input disabled and a message "對話精煉功能即將推出".

- [ ] **Step 3: Create presentations-workstation.tsx**

Main container. Read `documents-workstation.tsx` (96 lines) and follow same pattern:
- Left/right resizable split (same drag handler pattern, default 360px left panel)
- Left panel: presentations-source-panel (when configuring) or outline-editor (when editing)
- Right panel top: slide-preview
- Right panel bottom: presentations-chat
- Header: back button, title, error display
- On mount: create new session if none active

```typescript
// Key structure (simplified):
export function PresentationsWorkstation() {
  const { setActiveWorkstation } = useAppStore();
  const { activeSessionId, createSession, getActiveSession, error } = usePresentationsStore();
  const session = getActiveSession();

  useEffect(() => {
    if (!activeSessionId) createSession("新簡報");
  }, []);

  return (
    <div className="h-[calc(100vh-5.5rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-cy-border">
        <button onClick={() => setActiveWorkstation(null)}>
          <ArrowLeft className="h-4 w-4 text-cy-muted" />
        </button>
        <h2 className="text-sm font-semibold text-cy-text">簡報工作站</h2>
        {error && <span className="text-xs text-cy-error ml-auto">{error}</span>}
      </div>
      {/* Body: left + right split */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel (360px default, resizable) */}
        <div style={{ width: leftWidth }}>
          {session?.status === "editing"
            ? <OutlineEditor />
            : <PresentationsSourcePanel />
          }
        </div>
        <div className="w-1 bg-cy-border cursor-col-resize" onMouseDown={startResize} />
        {/* Right panel */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1"><SlidePreview /></div>
          <div className="h-[280px] border-t border-cy-border"><PresentationsChat /></div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

```bash
cd /Users/username/CycloneOpenClaw/dashboard && npm run build 2>&1 | tail -20
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
cd /Users/username/CycloneOpenClaw && git add dashboard/src/components/skills/workstations/presentations/ && git commit -m "feat(presentations): add source panel, chat, and main workstation

Left/right resizable layout with source selection, renderer/theme
pickers, generate button with SSE streaming, and slide preview."
```

---

## Task 9: Register Workstation and Wire Up

**Files:**
- Modify: `dashboard/src/config/skills-config.ts`
- Modify: `dashboard/src/components/skills/skills-panel.tsx`

- [ ] **Step 1: Add to skills-config.ts**

Read `dashboard/src/config/skills-config.ts`. Add after the documents entry (around line 21):

```typescript
{
  id: "presentations",
  name: "簡報工作站",
  description: "多來源 AI 簡報生成、編輯、匯出",
  icon: "📊",
  type: "workstation" as const,
  tags: ["簡報", "reveal.js", "Canva", "Felo", "投影片"],
},
```

- [ ] **Step 2: Add dispatch to skills-panel.tsx**

Read `dashboard/src/components/skills/skills-panel.tsx`. Add before the `WorkstationPlaceholder` fallback (around line 48):

```typescript
if (activeWorkstation === "presentations") {
  return <PresentationsWorkstation />;
}
```

Add the import at top:
```typescript
import { PresentationsWorkstation } from "./workstations/presentations/presentations-workstation";
```

- [ ] **Step 3: Verify the full flow**

```bash
cd /Users/username/CycloneOpenClaw/dashboard && npm run build
```

Expected: Build succeeds. The presentations workstation should now be accessible from the Skills panel.

- [ ] **Step 4: Commit**

```bash
cd /Users/username/CycloneOpenClaw && git add dashboard/src/config/skills-config.ts dashboard/src/components/skills/skills-panel.tsx && git commit -m "feat(presentations): register workstation in skills panel

Add presentations entry to skills-config and dispatch in skills-panel."
```

---

## Task 10: Manual End-to-End Smoke Test

- [ ] **Step 1: Start dev server**

```bash
cd /Users/username/CycloneOpenClaw/dashboard && npm run dev
```

- [ ] **Step 2: Test full flow**

1. Open dashboard in browser
2. Navigate to Skills panel
3. Click "簡報工作站" card
4. Verify: left/right split layout renders
5. Verify: renderer picker shows reveal.js selected
6. Verify: theme picker grid displays 24 themes
7. Type instructions: "Create a 3-slide presentation about AI in education"
8. Click "生成大綱"
9. Verify: SSE stream starts, status changes to "generating"
10. Verify: outline appears in editor after generation
11. Verify: reveal.js preview renders in iframe on the right
12. Click a slide thumbnail → verify block editor shows
13. Edit block text → verify preview updates
14. Drag a slide to reorder → verify order changes
15. Switch themes → verify preview updates colors/fonts

- [ ] **Step 3: Fix any issues found**

- [ ] **Step 4: Final commit if fixes were needed**

```bash
cd /Users/username/CycloneOpenClaw && git add -A && git commit -m "fix(presentations): smoke test fixes"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Install dependencies | package.json |
| 2 | Refactor shared source components | shared/source-list, shared/source-picker-modal |
| 3 | Create 24 theme definitions | lib/presentation-themes.ts |
| 4 | Create Zustand store with persist | stores/presentations-store.ts |
| 5 | Create outlineToRevealHtml utility | lib/presentations-utils.ts |
| 6 | Create generate API route | api/presentations/generate/route.ts |
| 7 | Create core UI components (6 files) | renderer-picker, theme-picker, slide-preview, thumbnails, block-editor, outline-editor |
| 8 | Create source panel + chat + workstation | source-panel, chat, workstation container |
| 9 | Register workstation | skills-config.ts, skills-panel.tsx |
| 10 | End-to-end smoke test | Manual verification |

**Estimated commits:** 9-10
**Scope:** Phase P0 (shared component refactoring) + P1 (reveal.js end-to-end) + P2 (outline editor with dnd-kit)
**Not included:** Canva integration (P3), Felo integration (P4), Chat refinement (P5) — separate plan
