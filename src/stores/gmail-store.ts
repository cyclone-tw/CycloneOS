// dashboard/src/stores/gmail-store.ts
import { create } from "zustand";
import type { GmailMessage, GmailThread } from "@/lib/gmail-client";

export interface ClassifyResult {
  labels: { id: string; confidence: number }[];
  summary: string;
  needsReply: boolean;
  urgency: "high" | "medium" | "low";
  draft?: string;
}

interface ClassifyCacheEntry {
  result: ClassifyResult;
  withReply: boolean;
}

interface GmailState {
  messages: GmailMessage[];
  selectedThread: GmailThread | null;
  selectedMessageId: string | null;
  searchQuery: string;
  isLoading: boolean;
  isThreadLoading: boolean;
  error: string | null;
  nextPageToken: string | null;
  classifyCache: Map<string, ClassifyCacheEntry>;

  setMessages: (messages: GmailMessage[]) => void;
  appendMessages: (messages: GmailMessage[], nextPageToken: string | null) => void;
  setSelectedThread: (thread: GmailThread | null) => void;
  setSelectedMessageId: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setIsLoading: (loading: boolean) => void;
  setIsThreadLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setNextPageToken: (token: string | null) => void;
  markAsRead: (messageIds: string[]) => void;
  getCachedClassify: (threadId: string, withReply: boolean) => ClassifyResult | null;
  setCachedClassify: (threadId: string, result: ClassifyResult, withReply: boolean) => void;
  reset: () => void;
}

export const useGmailStore = create<GmailState>((set, get) => ({
  messages: [],
  selectedThread: null,
  selectedMessageId: null,
  searchQuery: "",
  isLoading: false,
  isThreadLoading: false,
  error: null,
  nextPageToken: null,
  classifyCache: new Map(),

  setMessages: (messages) => set({ messages }),
  appendMessages: (messages, nextPageToken) =>
    set((state) => {
      const existingIds = new Set(state.messages.map((m) => m.id));
      const newMessages = messages.filter((m) => !existingIds.has(m.id));
      return { messages: [...state.messages, ...newMessages], nextPageToken };
    }),
  setSelectedThread: (thread) => set({ selectedThread: thread }),
  setSelectedMessageId: (id) => set({ selectedMessageId: id }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setIsThreadLoading: (loading) => set({ isThreadLoading: loading }),
  setError: (error) => set({ error }),
  setNextPageToken: (token) => set({ nextPageToken: token }),
  markAsRead: (messageIds) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        messageIds.includes(m.id) ? { ...m, isUnread: false } : m
      ),
    })),
  getCachedClassify: (threadId, withReply) => {
    const entry = get().classifyCache.get(threadId);
    if (!entry) return null;
    // If we need a reply but cached result didn't include one, miss cache
    if (withReply && !entry.withReply) return null;
    return entry.result;
  },
  setCachedClassify: (threadId, result, withReply) =>
    set((state) => {
      const next = new Map(state.classifyCache);
      next.set(threadId, { result, withReply });
      return { classifyCache: next };
    }),
  reset: () =>
    set({
      messages: [],
      selectedThread: null,
      selectedMessageId: null,
      searchQuery: "",
      isLoading: false,
      isThreadLoading: false,
      error: null,
      nextPageToken: null,
      classifyCache: new Map(),
    }),
}));
