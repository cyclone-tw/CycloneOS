# CycloneOS Dashboard — Milestone 1: Skeleton + Chat

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the three-column resizable layout with a working Chat panel that streams responses from Claude CLI subprocess via SSE.

**Architecture:** Next.js 15 App Router with Tailwind + shadcn/ui. Chat sends POST to `/api/chat`, which spawns `claude --print --verbose --output-format stream-json` and pipes stdout back as SSE. State managed by zustand. Panel widths persisted in localStorage via react-resizable-panels.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, react-resizable-panels, zustand, next/font (Noto Sans TC, JetBrains Mono)

**Spec:** `docs/superpowers/specs/2026-03-24-cycloneos-dashboard-design.md`

---

## File Map

| File | Responsibility |
|------|---------------|
| `dashboard/src/app/layout.tsx` | Root layout: fonts, theme, three-column structure |
| `dashboard/src/app/page.tsx` | Overview placeholder (shows "Overview" text) |
| `dashboard/src/app/api/chat/route.ts` | POST handler: spawn claude CLI, return SSE stream |
| `dashboard/src/components/layout/sidebar.tsx` | 56px icon sidebar with navigation |
| `dashboard/src/components/layout/resizable-layout.tsx` | Three-panel resizable wrapper |
| `dashboard/src/components/layout/dashboard-panel.tsx` | Middle panel container (renders children by route) |
| `dashboard/src/components/chat/chat-panel.tsx` | Right panel: message list + input bar |
| `dashboard/src/components/chat/message-list.tsx` | Scrollable message list with auto-scroll |
| `dashboard/src/components/chat/message-bubble.tsx` | Single message (user or assistant) |
| `dashboard/src/components/chat/input-bar.tsx` | Text input + send button + permission badge |
| `dashboard/src/components/chat/permission-badge.tsx` | Permission mode display + switcher |
| `dashboard/src/lib/claude-bridge.ts` | Spawn claude CLI, parse stream-json output |
| `dashboard/src/stores/chat-store.ts` | Zustand store: messages, session, streaming state |
| `dashboard/src/stores/app-store.ts` | Zustand store: sidebar selection, permission mode |
| `dashboard/src/types/chat.ts` | TypeScript types for messages, sessions, CLI output |

---

### Task 1: Next.js Project Initialization

**Files:**
- Create: `dashboard/` (entire scaffolded directory)
- Create: `dashboard/.env.local` (empty template)
- Modify: `CycloneOpenClaw/.gitignore`

- [ ] **Step 1: Scaffold Next.js project**

```bash
cd /Users/username/CycloneOpenClaw
npx create-next-app@latest dashboard \
  --typescript --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --use-npm --no-turbopack
```

- [ ] **Step 2: Install dependencies**

```bash
cd /Users/username/CycloneOpenClaw/dashboard
npm install react-resizable-panels zustand
npm install -D @types/node tailwindcss-animate
```

- [ ] **Step 3: Init shadcn/ui**

```bash
cd /Users/username/CycloneOpenClaw/dashboard
npx shadcn@latest init -d
```

Pick: New York style, Slate base color, CSS variables: yes.

- [ ] **Step 4: Add shadcn components needed for M1**

```bash
npx shadcn@latest add button input scroll-area tooltip separator badge
```

- [ ] **Step 5: Create .env.local template**

Create `dashboard/.env.local`:
```env
# CycloneOS Dashboard — API Keys
# Copy this file and fill in your values

# Notion
NOTION_TOKEN=
NOTION_TASKS_DB_ID=<YOUR_NOTION_DB_ID>

# GitHub
GITHUB_TOKEN=

# Groq
GROQ_API_KEY=

# Brave Search
BRAVE_API_KEY=

# Apify
APIFY_API_KEY=

# Felo
FELO_API_KEY=

# Gmail + Google Drive (personal)
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=

# Gmail + Google Drive (school)
SCHOOL_GMAIL_CLIENT_ID=
SCHOOL_GMAIL_CLIENT_SECRET=
SCHOOL_GMAIL_REFRESH_TOKEN=
```

- [ ] **Step 6: Update .gitignore**

Append to `CycloneOpenClaw/.gitignore`:
```
# Dashboard
dashboard/.env.local
dashboard/node_modules/
dashboard/.next/
```

- [ ] **Step 7: Verify dev server starts**

```bash
cd /Users/username/CycloneOpenClaw/dashboard
npm run dev
```

Expected: Server starts on http://localhost:3000, shows default Next.js page.

- [ ] **Step 8: Commit**

```bash
git add dashboard/ .gitignore
git commit -m "feat(dashboard): scaffold Next.js 15 + Tailwind + shadcn/ui"
```

---

### Task 2: Dark Theme + Brand Fonts

**Files:**
- Modify: `dashboard/src/app/layout.tsx`
- Modify: `dashboard/src/app/globals.css`
- Modify: `dashboard/tailwind.config.ts`

- [ ] **Step 1: Configure Tailwind dark theme colors**

Edit `dashboard/tailwind.config.ts` — **merge** CycloneOS brand colors into the existing shadcn-generated config (do NOT replace the file wholesale; preserve shadcn's CSS variable references like `bg-background`, `text-foreground`, etc.):

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "cy-bg": "#0F172A",
        "cy-card": "#1E293B",
        "cy-input": "#334155",
        "cy-accent": "#38BDF8",
        "cy-silver": "#C0C0C0",
        "cy-text": "#F1F5F9",
        "cy-muted": "#94A3B8",
        "cy-success": "#22C55E",
        "cy-error": "#EF4444",
        "cy-warning": "#F59E0B",
      },
      fontFamily: {
        sans: ["var(--font-noto-sans-tc)", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
```

- [ ] **Step 2: Setup fonts in layout.tsx**

Replace `dashboard/src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Noto_Sans_TC, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const notoSansTC = Noto_Sans_TC({
  subsets: ["latin"],
  variable: "--font-noto-sans-tc",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CycloneOS Dashboard",
  description: "AI Workstation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW" className="dark">
      <body
        className={`${notoSansTC.variable} ${jetbrainsMono.variable} font-sans bg-cy-bg text-cy-text antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Set global CSS for dark theme**

Replace `dashboard/src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 222.2 47.4% 11.2%;
    --foreground: 210 40% 96%;
    --card: 217.2 32.6% 17.5%;
    --card-foreground: 210 40% 96%;
    --primary: 199 89% 60%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --muted: 217.2 32.6% 40%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 199 89% 60%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --border: 217.2 32.6% 25%;
    --input: 217.2 32.6% 30%;
    --ring: 199 89% 60%;
    --radius: 0.5rem;
  }
}

body {
  min-height: 100vh;
  overflow: hidden;
}
```

- [ ] **Step 4: Verify dark theme renders**

```bash
cd /Users/username/CycloneOpenClaw/dashboard && npm run dev
```

Open http://localhost:3000 — should see dark slate background with correct fonts.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/app/ dashboard/tailwind.config.ts
git commit -m "feat(dashboard): dark theme + Noto Sans TC / JetBrains Mono fonts"
```

---

### Task 3: Types + Stores

**Files:**
- Create: `dashboard/src/types/chat.ts`
- Create: `dashboard/src/stores/chat-store.ts`
- Create: `dashboard/src/stores/app-store.ts`

- [ ] **Step 1: Define chat types**

Create `dashboard/src/types/chat.ts`:

```ts
export type MessageRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
}

export type PermissionMode = "acceptEdits" | "bypassPermissions" | "default";

export interface SessionInfo {
  id: string;
  title: string;
  createdAt: number;
}

/** One line of claude --output-format stream-json --verbose */
export interface ClaudeStreamEvent {
  type: string;
  subtype?: string;
  message?: {
    role: string;
    content: Array<{
      type: string;
      text?: string;
    }>;
  };
  [key: string]: unknown;
}
```

- [ ] **Step 2: Create chat store**

Create `dashboard/src/stores/chat-store.ts`:

```ts
import { create } from "zustand";
import type { ChatMessage, SessionInfo, PermissionMode } from "@/types/chat";

interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  currentSessionId: string | null;
  sessions: SessionInfo[];
  permissionMode: PermissionMode;

  addMessage: (msg: ChatMessage) => void;
  appendToLastAssistant: (text: string) => void;
  setStreaming: (v: boolean) => void;
  setSessionId: (id: string | null) => void;
  setSessions: (sessions: SessionInfo[]) => void;
  setPermissionMode: (mode: PermissionMode) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isStreaming: false,
  currentSessionId: null,
  sessions: [],
  permissionMode: "acceptEdits",

  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, msg] })),

  appendToLastAssistant: (text) =>
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last?.role === "assistant") {
        msgs[msgs.length - 1] = { ...last, content: last.content + text };
      }
      return { messages: msgs };
    }),

  setStreaming: (v) => set({ isStreaming: v }),
  setSessionId: (id) => set({ currentSessionId: id }),
  setSessions: (sessions) => set({ sessions }),
  setPermissionMode: (mode) => set({ permissionMode: mode }),
  clearMessages: () => set({ messages: [] }),
}));
```

- [ ] **Step 3: Create app store**

Create `dashboard/src/stores/app-store.ts`:

```ts
import { create } from "zustand";

export type SidebarPage = "overview" | "tasks" | "calendar" | "files" | "search" | "settings";

interface AppState {
  activePage: SidebarPage;
  setActivePage: (page: SidebarPage) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activePage: "overview",
  setActivePage: (page) => set({ activePage: page }),
}));
```

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/types/ dashboard/src/stores/
git commit -m "feat(dashboard): chat types + zustand stores"
```

---

### Task 4: Three-Column Resizable Layout

**Files:**
- Create: `dashboard/src/components/layout/sidebar.tsx`
- Create: `dashboard/src/components/layout/resizable-layout.tsx`
- Create: `dashboard/src/components/layout/dashboard-panel.tsx`
- Modify: `dashboard/src/app/layout.tsx`

- [ ] **Step 1: Build sidebar**

Create `dashboard/src/components/layout/sidebar.tsx`:

```tsx
"use client";

import { useAppStore, type SidebarPage } from "@/stores/app-store";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const NAV_ITEMS: { page: SidebarPage; icon: string; label: string }[] = [
  { page: "overview", icon: "🏠", label: "Overview" },
  { page: "tasks", icon: "📋", label: "Tasks" },
  { page: "calendar", icon: "📅", label: "Calendar" },
  { page: "files", icon: "📁", label: "Files" },
  { page: "search", icon: "🔍", label: "Search" },
];

export function Sidebar() {
  const { activePage, setActivePage } = useAppStore();

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-full w-14 flex-col items-center border-r border-cy-input/50 bg-cy-card py-3 gap-1">
        {/* Logo */}
        <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-cy-accent text-cy-bg font-bold text-lg">
          C
        </div>

        {/* Nav */}
        {NAV_ITEMS.map((item) => (
          <Tooltip key={item.page}>
            <TooltipTrigger asChild>
              <button
                onClick={() => setActivePage(item.page)}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-md text-lg transition-colors",
                  activePage === item.page
                    ? "bg-cy-accent/20 text-cy-accent"
                    : "text-cy-muted hover:bg-cy-input/50 hover:text-cy-text"
                )}
              >
                {item.icon}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{item.label}</TooltipContent>
          </Tooltip>
        ))}

        <div className="flex-1" />

        {/* Settings */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setActivePage("settings")}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-md text-lg transition-colors",
                activePage === "settings"
                  ? "bg-cy-accent/20 text-cy-accent"
                  : "text-cy-muted hover:bg-cy-input/50 hover:text-cy-text"
              )}
            >
              ⚙️
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Settings</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
```

- [ ] **Step 2: Build dashboard panel container**

Create `dashboard/src/components/layout/dashboard-panel.tsx`:

```tsx
"use client";

import { useAppStore } from "@/stores/app-store";

export function DashboardPanel() {
  const { activePage } = useAppStore();

  return (
    <div className="flex h-full flex-col overflow-auto bg-cy-bg p-4">
      <h1 className="text-xl font-bold capitalize text-cy-text">{activePage}</h1>
      <p className="mt-2 text-cy-muted text-sm">
        {activePage === "overview" && "Dashboard overview — coming in Task 7+"}
        {activePage === "tasks" && "Notion CY Task v2 — coming in Milestone 3"}
        {activePage === "calendar" && "Calendar — coming in Milestone 3"}
        {activePage === "files" && "File browser — coming in Milestone 3"}
        {activePage === "search" && "Cross-source search — coming in Milestone 4"}
        {activePage === "settings" && "Settings — coming in Milestone 4"}
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Build resizable layout**

Create `dashboard/src/components/layout/resizable-layout.tsx`:

```tsx
"use client";

import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Sidebar } from "./sidebar";
import { DashboardPanel } from "./dashboard-panel";

export function ResizableLayout({ chatPanel }: { chatPanel: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <PanelGroup
        direction="horizontal"
        autoSaveId="cycloneos-panels"
      >
        <Panel defaultSize={60} minSize={30}>
          <DashboardPanel />
        </Panel>
        <PanelResizeHandle className="w-1 bg-cy-input/30 hover:bg-cy-accent/50 transition-colors" />
        <Panel defaultSize={40} minSize={25}>
          {chatPanel}
        </Panel>
      </PanelGroup>
    </div>
  );
}
```

- [ ] **Step 4: Wire into root layout**

Update `dashboard/src/app/layout.tsx` — add the resizable layout to the body (keep fonts from Task 2). The chat panel will be a placeholder for now:

Update `dashboard/src/app/page.tsx`:

```tsx
import { ResizableLayout } from "@/components/layout/resizable-layout";

export default function Home() {
  return (
    <ResizableLayout
      chatPanel={
        <div className="flex h-full items-center justify-center bg-cy-card text-cy-muted">
          Chat panel — coming in Task 5
        </div>
      }
    />
  );
}
```

- [ ] **Step 5: Verify three-column layout with drag handles**

```bash
cd /Users/username/CycloneOpenClaw/dashboard && npm run dev
```

Open http://localhost:3000:
- Left: 56px icon sidebar with nav items
- Middle: "Overview" placeholder text
- Right: "Chat panel — coming" placeholder
- Drag handle between middle and right should resize panels
- Panel widths should persist on page reload (localStorage)

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/components/layout/ dashboard/src/app/page.tsx
git commit -m "feat(dashboard): three-column resizable layout + icon sidebar"
```

---

### Task 5: Chat Panel UI (Frontend Only)

**Files:**
- Create: `dashboard/src/components/chat/chat-panel.tsx`
- Create: `dashboard/src/components/chat/message-list.tsx`
- Create: `dashboard/src/components/chat/message-bubble.tsx`
- Create: `dashboard/src/components/chat/input-bar.tsx`
- Create: `dashboard/src/components/chat/permission-badge.tsx`
- Modify: `dashboard/src/app/page.tsx`

- [ ] **Step 1: Build permission badge**

Create `dashboard/src/components/chat/permission-badge.tsx`:

```tsx
"use client";

import { useChatStore } from "@/stores/chat-store";
import type { PermissionMode } from "@/types/chat";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const MODE_CONFIG: Record<PermissionMode, { label: string; color: string }> = {
  acceptEdits: { label: "🟢 Auto Edit", color: "bg-cy-success/20 text-cy-success" },
  bypassPermissions: { label: "🟡 Full Auto", color: "bg-cy-warning/20 text-cy-warning" },
  default: { label: "🔵 Safe", color: "bg-cy-accent/20 text-cy-accent" },
};

const MODES: PermissionMode[] = ["acceptEdits", "default", "bypassPermissions"];

export function PermissionBadge() {
  const { permissionMode, setPermissionMode } = useChatStore();
  const config = MODE_CONFIG[permissionMode];

  const cycleMode = () => {
    const idx = MODES.indexOf(permissionMode);
    const next = MODES[(idx + 1) % MODES.length];
    if (next === "bypassPermissions") {
      if (!confirm("啟用 Full Auto 模式？這將允許所有操作自動執行，包括 shell 指令。")) return;
    }
    setPermissionMode(next);
  };

  return (
    <Badge
      variant="outline"
      className={cn("cursor-pointer select-none text-xs", config.color)}
      onClick={cycleMode}
    >
      {config.label}
    </Badge>
  );
}
```

- [ ] **Step 2: Build message bubble**

Create `dashboard/src/components/chat/message-bubble.tsx`:

```tsx
import type { ChatMessage } from "@/types/chat";
import { cn } from "@/lib/utils";

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-2 px-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cy-accent text-xs font-bold text-cy-bg">
          C
        </div>
      )}
      <div
        className={cn(
          "max-w-[80%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap",
          isUser
            ? "bg-cy-input text-cy-text"
            : "bg-cy-card border border-cy-input/50 text-cy-text"
        )}
      >
        {message.content}
      </div>
      {isUser && (
        <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cy-input text-xs text-cy-muted">
          U
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Build message list**

Create `dashboard/src/components/chat/message-list.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import { useChatStore } from "@/stores/chat-store";
import { MessageBubble } from "./message-bubble";
import { ScrollArea } from "@/components/ui/scroll-area";

export function MessageList() {
  const { messages, isStreaming } = useChatStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  return (
    <ScrollArea className="flex-1 px-1">
      <div className="flex flex-col gap-3 py-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-cy-muted text-sm">
            <div className="text-4xl mb-3">🌀</div>
            <p>Ask CycloneOS anything...</p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isStreaming && (
          <div className="px-3 text-cy-accent text-xs animate-pulse">
            ● Thinking...
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
```

- [ ] **Step 4: Build input bar**

Create `dashboard/src/components/chat/input-bar.tsx`:

```tsx
"use client";

import { useState, useRef, useCallback } from "react";
import { useChatStore } from "@/stores/chat-store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PermissionBadge } from "./permission-badge";

export function InputBar({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { isStreaming } = useChatStore();

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setText("");
    inputRef.current?.focus();
  }, [text, isStreaming, onSend]);

  return (
    <div className="border-t border-cy-input/50 bg-cy-card px-3 py-2">
      <div className="flex items-center gap-2">
        <PermissionBadge />
        <Input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="Ask CycloneOS anything..."
          disabled={isStreaming}
          className="flex-1 border-cy-input bg-cy-bg text-cy-text placeholder:text-cy-muted"
        />
        <Button
          size="sm"
          onClick={handleSend}
          disabled={!text.trim() || isStreaming}
          className="bg-cy-accent text-cy-bg hover:bg-cy-accent/80"
        >
          ↑
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Build chat panel**

Create `dashboard/src/components/chat/chat-panel.tsx`:

```tsx
"use client";

import { useCallback } from "react";
import { useChatStore } from "@/stores/chat-store";
import type { ChatMessage } from "@/types/chat";
import { MessageList } from "./message-list";
import { InputBar } from "./input-bar";

export function ChatPanel() {
  const { addMessage, appendToLastAssistant, setStreaming } = useChatStore();

  const handleSend = useCallback(
    async (text: string) => {
      // Add user message
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        timestamp: Date.now(),
      };
      addMessage(userMsg);

      // Add empty assistant message
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        timestamp: Date.now(),
      };
      addMessage(assistantMsg);
      setStreaming(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: text,
            sessionId: useChatStore.getState().currentSessionId,
            permissionMode: useChatStore.getState().permissionMode,
          }),
        });

        if (!res.ok || !res.body) {
          appendToLastAssistant(`Error: ${res.status} ${res.statusText}`);
          setStreaming(false);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? ""; // keep incomplete line for next chunk

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") break;
              try {
                const event = JSON.parse(data);
                if (event.type === "text") {
                  appendToLastAssistant(event.content);
                } else if (event.type === "error") {
                  appendToLastAssistant(`\n\nError: ${event.content}`);
                } else if (event.type === "session") {
                  useChatStore.getState().setSessionId(event.sessionId);
                }
              } catch {
                // Not JSON, skip
              }
            }
          }
        }
      } catch (err) {
        appendToLastAssistant(`\n\nConnection error: ${String(err)}`);
      } finally {
        setStreaming(false);
      }
    },
    [addMessage, appendToLastAssistant, setStreaming]
  );

  return (
    <div className="flex h-full flex-col bg-cy-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-cy-input/50 px-3 py-2">
        <span className="text-sm font-medium text-cy-text">Chat</span>
        <span className="text-xs text-cy-muted">CycloneOS</span>
      </div>
      <MessageList />
      <InputBar onSend={handleSend} />
    </div>
  );
}
```

- [ ] **Step 6: Wire chat panel into page.tsx**

Update `dashboard/src/app/page.tsx`:

```tsx
import { ResizableLayout } from "@/components/layout/resizable-layout";
import { ChatPanel } from "@/components/chat/chat-panel";

export default function Home() {
  return <ResizableLayout chatPanel={<ChatPanel />} />;
}
```

- [ ] **Step 7: Verify chat UI renders**

```bash
cd /Users/username/CycloneOpenClaw/dashboard && npm run dev
```

Open http://localhost:3000:
- Right panel shows chat with empty state ("Ask CycloneOS anything...")
- Input bar with permission badge (🟢 Auto Edit) and send button
- Type text → click send → user message appears (assistant will error since API not built yet)
- Permission badge cycles on click (with confirm dialog for Full Auto)

- [ ] **Step 8: Commit**

```bash
git add dashboard/src/components/chat/ dashboard/src/app/page.tsx
git commit -m "feat(dashboard): chat panel UI — messages, input bar, permission badge"
```

---

### Task 6: Claude CLI Bridge (Server-Side)

**Files:**
- Create: `dashboard/src/lib/claude-bridge.ts`
- Create: `dashboard/src/app/api/chat/route.ts`

- [ ] **Step 1: Build claude-bridge.ts**

Create `dashboard/src/lib/claude-bridge.ts`:

```ts
import { spawn, type ChildProcess } from "child_process";
import type { PermissionMode } from "@/types/chat";

const CWD = "/Users/username/CycloneOpenClaw";
const VAULT =
  "/Users/username/Library/CloudStorage/GoogleDrive-user@gmail.com/我的雲端硬碟/Obsidian-Cyclone";

export interface ClaudeBridgeOptions {
  prompt: string;
  sessionId?: string | null;
  permissionMode?: PermissionMode;
}

/**
 * Spawn claude CLI in --print mode and return the child process.
 * Caller is responsible for reading stdout/stderr and handling lifecycle.
 */
export function spawnClaude(options: ClaudeBridgeOptions): ChildProcess {
  const args = [
    "--print",
    "--verbose",
    "--output-format",
    "stream-json",
    "--permission-mode",
    options.permissionMode ?? "acceptEdits",
  ];

  if (options.sessionId) {
    args.push("--resume", options.sessionId);
  }

  args.push("--add-dir", VAULT);
  args.push(options.prompt);

  return spawn("claude", args, {
    cwd: CWD,
    env: { ...process.env },
    stdio: ["pipe", "pipe", "pipe"],
  });
}

/** Check if claude CLI is available */
export async function checkClaudeHealth(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn("claude", ["--version"], { stdio: "pipe" });
    proc.on("close", (code) => resolve(code === 0));
    proc.on("error", () => resolve(false));
    setTimeout(() => {
      proc.kill();
      resolve(false);
    }, 5000);
  });
}
```

- [ ] **Step 2: Build /api/chat SSE route**

Create `dashboard/src/app/api/chat/route.ts`:

```ts
import { NextRequest } from "next/server";
import { spawnClaude } from "@/lib/claude-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { prompt, sessionId, permissionMode } = body;

  if (!prompt || typeof prompt !== "string") {
    return new Response("Missing prompt", { status: 400 });
  }

  const proc = spawnClaude({ prompt, sessionId, permissionMode });

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      let lastActivity = Date.now();

      const sendSSE = (type: string, content: string, extra?: Record<string, unknown>) => {
        if (closed) return;
        const data = JSON.stringify({ type, content, ...extra });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(timeoutCheck);
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      };

      proc.stdout?.on("data", (chunk: Buffer) => {
        lastActivity = Date.now();
        const text = chunk.toString();
        for (const line of text.split("\n")) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);

            // Extract session ID from init event
            if (event.type === "system" && event.subtype === "init" && event.session_id) {
              sendSSE("session", "", { sessionId: event.session_id });
            }

            // Extract text content from assistant messages
            if (event.type === "assistant") {
              const content = event.message?.content;
              if (Array.isArray(content)) {
                for (const block of content) {
                  if (block.type === "text" && block.text) {
                    sendSSE("text", block.text);
                  }
                }
              }
            }

            // Handle content_block_delta for streaming text
            if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
              sendSSE("text", event.delta.text);
            }

          } catch {
            // Non-JSON line, skip
          }
        }
      });

      proc.stderr?.on("data", (chunk: Buffer) => {
        const text = chunk.toString().trim();
        if (text) sendSSE("error", text);
      });

      proc.on("close", (code) => {
        if (code !== 0) sendSSE("error", `Process exited with code ${code}`);
        cleanup();
      });

      proc.on("error", (err) => {
        sendSSE("error", `Failed to start claude: ${err.message}`);
        cleanup();
      });

      // Timeout: 120 seconds with no output
      const timeoutCheck = setInterval(() => {
        if (Date.now() - lastActivity > 120_000) {
          sendSSE("error", "Response timeout (120s no output)");
          proc.kill();
          cleanup();
        }
      }, 10_000);
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

- [ ] **Step 3: Test end-to-end chat**

```bash
cd /Users/username/CycloneOpenClaw/dashboard && npm run dev
```

Open http://localhost:3000. In the chat panel:
1. Type "Hello, what can you do?" and press Enter
2. Should see streaming response from Claude CLI
3. Check terminal for any spawn errors

**Expected:** User message appears instantly, assistant response streams in token by token.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/lib/claude-bridge.ts dashboard/src/app/api/chat/route.ts
git commit -m "feat(dashboard): Claude CLI bridge + SSE chat API route"
```

---

### Task 7: Health Check + Error States

**Files:**
- Create: `dashboard/src/app/api/health/route.ts`
- Modify: `dashboard/src/components/chat/chat-panel.tsx`

- [ ] **Step 1: Build health check API**

Create `dashboard/src/app/api/health/route.ts`:

```ts
import { checkClaudeHealth } from "@/lib/claude-bridge";

export const dynamic = "force-dynamic";

export async function GET() {
  const claudeOk = await checkClaudeHealth();
  return Response.json({
    status: claudeOk ? "ok" : "degraded",
    claude: claudeOk,
    timestamp: new Date().toISOString(),
  });
}
```

- [ ] **Step 2: Add health check to chat panel header**

Update `dashboard/src/components/chat/chat-panel.tsx` — add a useEffect that checks `/api/health` on mount and shows a warning if Claude is not available:

Add to the ChatPanel component, before the return:

```tsx
const [claudeOk, setClaudeOk] = useState(true);

useEffect(() => {
  fetch("/api/health")
    .then((r) => r.json())
    .then((d) => setClaudeOk(d.claude))
    .catch(() => setClaudeOk(false));
}, []);
```

In the header div, after the "CycloneOS" span:

```tsx
{!claudeOk && (
  <span className="text-xs text-cy-error">● Claude CLI unavailable</span>
)}
```

- [ ] **Step 3: Verify health check works**

Open http://localhost:3000 — header should show "CycloneOS" without error.
Test failure: temporarily rename `claude` binary or set wrong PATH to see error indicator.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/app/api/health/ dashboard/src/components/chat/chat-panel.tsx
git commit -m "feat(dashboard): health check + Claude CLI error state"
```

---

### Task 8: Final Integration Test + Cleanup

**Files:**
- Modify: `dashboard/src/app/layout.tsx` (fix any stale references)
- Modify: `dashboard/src/components/layout/resizable-layout.tsx` (if needed)

- [ ] **Step 1: Full integration test**

```bash
cd /Users/username/CycloneOpenClaw/dashboard && npm run dev
```

Test checklist:
1. ✅ Three-column layout renders (sidebar + dashboard + chat)
2. ✅ Sidebar navigation highlights active page
3. ✅ Panels are resizable by dragging
4. ✅ Panel widths persist on page reload
5. ✅ Chat: type message → send → streaming response appears
6. ✅ Chat: permission badge cycles (acceptEdits → default → bypassPermissions with confirm)
7. ✅ Chat: error shown if Claude CLI unavailable
8. ✅ Dark theme with correct colors and fonts
9. ✅ No TypeScript errors: `npm run build`

- [ ] **Step 2: Run production build**

```bash
cd /Users/username/CycloneOpenClaw/dashboard && npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Fix any issues found**

Address any build errors or visual issues discovered in steps 1-2.

- [ ] **Step 4: Final commit**

```bash
git add dashboard/
git commit -m "feat(dashboard): Milestone 1 complete — skeleton + chat with Claude CLI"
```

---

## Summary

| Task | Description | Key Deliverable |
|------|-------------|-----------------|
| 1 | Project scaffold | Next.js + Tailwind + shadcn/ui running |
| 2 | Dark theme + fonts | CycloneOS brand visuals |
| 3 | Types + stores | TypeScript types + zustand state |
| 4 | Three-column layout | Resizable panels + sidebar |
| 5 | Chat panel UI | Messages + input + permissions |
| 6 | Claude CLI bridge | SSE streaming from CLI subprocess |
| 7 | Health check | Error states for CLI unavailability |
| 8 | Integration test | Full E2E verification + prod build |

**Total tasks:** 8 tasks, ~40 steps
**Estimated commits:** 8

After Milestone 1, the dashboard will have a working Chat that can talk to Claude Code through the CLI. Milestone 2 will add the Overview dashboard page (stats, timeline, OpenClaw feed).
