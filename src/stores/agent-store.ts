import { create } from "zustand";
import type { ChatMessage, AgentTab, ActivityEvent, PermissionMode, ClaudeModel } from "@/types/chat";

const MAX_ACTIVITIES = 200;

interface AgentStoreState {
  // Tab management
  tabs: AgentTab[];
  activeTabId: string;

  // Per-tab messages
  messagesByTab: Record<string, ChatMessage[]>;

  // Activity feed
  activities: ActivityEvent[];

  // UI state
  isActivityOpen: boolean;
  isHistoryOpen: boolean;

  // Global settings (single source of truth — Phase 3 complete)
  permissionMode: PermissionMode;
  model: ClaudeModel;
  enterToSend: boolean;

  // Actions: tabs
  addTab: (agentType: string) => string;
  removeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  setTabStatus: (tabId: string, status: AgentTab["status"]) => void;
  setTabProcessId: (tabId: string, processId: string | null) => void;
  setTabSessionId: (tabId: string, sessionId: string) => void;

  // Actions: messages
  addMessage: (tabId: string, msg: ChatMessage) => void;
  appendToLastAssistant: (tabId: string, text: string) => void;
  clearTabMessages: (tabId: string) => void;

  // Actions: activities
  addActivity: (event: ActivityEvent) => void;

  // Actions: UI
  toggleActivity: () => void;
  toggleHistory: () => void;

  // Actions: settings
  setPermissionMode: (mode: PermissionMode) => void;
  setModel: (model: ClaudeModel) => void;
  setEnterToSend: (v: boolean) => void;
}

const DEFAULT_TAB_ID = "default-general";

export const useAgentStore = create<AgentStoreState>((set) => ({
  tabs: [{ id: DEFAULT_TAB_ID, agentType: "general", status: "idle", sessionId: null, processId: null }],
  activeTabId: DEFAULT_TAB_ID,
  messagesByTab: { [DEFAULT_TAB_ID]: [] },
  activities: [],
  isActivityOpen: false,
  isHistoryOpen: false,
  permissionMode: "acceptEdits",
  model: "sonnet",
  enterToSend: true,

  addTab: (agentType) => {
    const id = crypto.randomUUID().slice(0, 8);
    set((s) => ({
      tabs: [...s.tabs, { id, agentType, status: "idle", sessionId: null, processId: null }],
      activeTabId: id,
      messagesByTab: { ...s.messagesByTab, [id]: [] },
    }));
    return id;
  },

  removeTab: (tabId) =>
    set((s) => {
      const remaining = s.tabs.filter((t) => t.id !== tabId);
      if (remaining.length === 0) return s;
      const newMessages = { ...s.messagesByTab };
      delete newMessages[tabId];
      return {
        tabs: remaining,
        activeTabId: s.activeTabId === tabId ? remaining[0].id : s.activeTabId,
        messagesByTab: newMessages,
      };
    }),

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  setTabStatus: (tabId, status) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, status } : t)),
    })),

  setTabProcessId: (tabId, processId) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, processId } : t)),
    })),

  setTabSessionId: (tabId, sessionId) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, sessionId } : t)),
    })),

  addMessage: (tabId, msg) =>
    set((s) => ({
      messagesByTab: {
        ...s.messagesByTab,
        [tabId]: [...(s.messagesByTab[tabId] ?? []), msg],
      },
    })),

  appendToLastAssistant: (tabId, text) =>
    set((s) => {
      const msgs = [...(s.messagesByTab[tabId] ?? [])];
      const last = msgs[msgs.length - 1];
      if (last?.role === "assistant") {
        msgs[msgs.length - 1] = { ...last, content: last.content + text };
      }
      return { messagesByTab: { ...s.messagesByTab, [tabId]: msgs } };
    }),

  clearTabMessages: (tabId) =>
    set((s) => ({
      messagesByTab: { ...s.messagesByTab, [tabId]: [] },
    })),

  addActivity: (event) =>
    set((s) => {
      const activities = [event, ...s.activities].slice(0, MAX_ACTIVITIES);
      return { activities };
    }),

  toggleActivity: () => set((s) => ({ isActivityOpen: !s.isActivityOpen })),
  toggleHistory: () => set((s) => ({ isHistoryOpen: !s.isHistoryOpen })),

  setPermissionMode: (mode) => set({ permissionMode: mode }),
  setModel: (model) => set({ model }),
  setEnterToSend: (v) => set({ enterToSend: v }),
}));
