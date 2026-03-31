// dashboard/src/stores/documents-store.ts
import { create } from "zustand";

export type OutputFormat = "md" | "docx" | "pdf" | "html-slides" | "pptx" | "xlsx";
export type SessionStatus = "configuring" | "processing" | "completed";

export interface SourceItem {
  id: string;
  type: "local" | "drive" | "notion" | "obsidian" | "text" | "research" | "url";
  path: string;
  name: string;
  isDirectory: boolean;
  textContent?: string;    // For type="text" (user pasted) and type="research" (synthesized)
  researchQuery?: string;  // For type="research" (original search query)
  sourceUrl?: string;      // For type="url" (original URL)
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
  outputContent: string;
  chatHistory: DocChatMessage[];
  claudeSessionId: string | null; // Claude CLI session ID for --resume
}

interface DocumentsState {
  currentSession: DocumentSession | null;
  isProcessing: boolean;
  error: string | null;

  newSession: () => void;
  addSources: (sources: SourceItem[]) => void;
  removeSource: (id: string) => void;
  toggleFormat: (format: OutputFormat) => void;
  setOutputPath: (path: string) => void;
  setProcessing: (processing: boolean) => void;
  setOutputContent: (content: string) => void;
  appendOutputContent: (chunk: string) => void;
  setError: (error: string | null) => void;
  addChatMessage: (msg: DocChatMessage) => void;
  setClaudeSessionId: (id: string) => void;
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
    claudeSessionId: null,
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
    const status = processing
      ? "processing"
      : session.outputContent ? "completed" : "configuring";
    set({
      isProcessing: processing,
      currentSession: { ...session, status },
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

  setClaudeSessionId: (id) => {
    const session = get().currentSession;
    if (!session) return;
    set({ currentSession: { ...session, claudeSessionId: id } });
  },
}));
