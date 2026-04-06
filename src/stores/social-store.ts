// src/stores/social-store.ts
// Zustand store for the Social Posting workstation.

import { create } from "zustand";
import type { Platform, Tone } from "@/lib/social/prompts";

// --- Types ---

export interface UploadedImage {
  id: string;
  file: File;
  previewUrl: string;
  uploadedUrl?: string;
}

export interface GeneratedContents {
  fb?: string;
  ig?: string;
  line?: string;
  school?: string;
  notion?: string;
  hashtags?: string;
}

export interface HistoryPost {
  id: string;
  title: string;
  platforms: string[];
  published: string[];
  status: "draft" | "partial" | "published";
  date: string | null;
  notionUrl: string;
}

// --- State & Actions ---

interface SocialState {
  // Source
  sourceText: string;
  sourceLabel: string;

  // Images
  images: UploadedImage[];

  // Generation config
  platforms: Platform[];
  tone: Tone;

  // Generation result
  isGenerating: boolean;
  generatedContents: GeneratedContents | null;
  activePreviewTab: Platform | "hashtags";

  // Publishing
  isPublishing: boolean;
  lastPublishedUrl: string | null;

  // History
  history: HistoryPost[];

  // Error
  error: string | null;

  // Actions — Source
  setSourceText: (text: string, label?: string) => void;

  // Actions — Images
  addImages: (files: File[]) => void;
  removeImage: (id: string) => void;
  setImageUploadedUrl: (id: string, url: string) => void;

  // Actions — Config
  togglePlatform: (platform: Platform) => void;
  setTone: (tone: Tone) => void;

  // Actions — Generation
  setGenerating: (generating: boolean) => void;
  setGeneratedContents: (contents: GeneratedContents | null) => void;
  updateGeneratedContent: (platform: keyof GeneratedContents, value: string) => void;
  setActivePreviewTab: (tab: Platform | "hashtags") => void;

  // Actions — Publishing
  setPublishing: (publishing: boolean) => void;
  setLastPublishedUrl: (url: string | null) => void;

  // Actions — History
  setHistory: (history: HistoryPost[]) => void;

  // Actions — Error
  setError: (error: string | null) => void;

  // Reset
  reset: () => void;
}

const initialState = {
  sourceText: "",
  sourceLabel: "",
  images: [] as UploadedImage[],
  platforms: ["fb"] as Platform[],
  tone: "knowledge" as Tone,
  isGenerating: false,
  generatedContents: null,
  activePreviewTab: "fb" as Platform | "hashtags",
  isPublishing: false,
  lastPublishedUrl: null,
  history: [] as HistoryPost[],
  error: null,
};

export const useSocialStore = create<SocialState>((set, get) => ({
  ...initialState,

  setSourceText: (text, label) =>
    set({ sourceText: text, ...(label !== undefined ? { sourceLabel: label } : {}) }),

  addImages: (files) => {
    const newImages: UploadedImage[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    set((state) => ({ images: [...state.images, ...newImages] }));
  },

  removeImage: (id) => {
    const image = get().images.find((img) => img.id === id);
    if (image) URL.revokeObjectURL(image.previewUrl);
    set((state) => ({ images: state.images.filter((img) => img.id !== id) }));
  },

  setImageUploadedUrl: (id, url) =>
    set((state) => ({
      images: state.images.map((img) =>
        img.id === id ? { ...img, uploadedUrl: url } : img
      ),
    })),

  togglePlatform: (platform) => {
    const { platforms } = get();
    if (platforms.includes(platform)) {
      // Ensure at least 1 platform remains
      if (platforms.length <= 1) return;
      set({ platforms: platforms.filter((p) => p !== platform) });
    } else {
      set({ platforms: [...platforms, platform] });
    }
  },

  setTone: (tone) => set({ tone }),

  setGenerating: (generating) => set({ isGenerating: generating }),

  setGeneratedContents: (contents) => set({ generatedContents: contents }),

  updateGeneratedContent: (platform, value) =>
    set((state) => ({
      generatedContents: state.generatedContents
        ? { ...state.generatedContents, [platform]: value }
        : { [platform]: value },
    })),

  setActivePreviewTab: (tab) => set({ activePreviewTab: tab }),

  setPublishing: (publishing) => set({ isPublishing: publishing }),

  setLastPublishedUrl: (url) => set({ lastPublishedUrl: url }),

  setHistory: (history) => set({ history }),

  setError: (error) => set({ error }),

  reset: () => {
    // Revoke all object URLs before resetting
    const { images } = get();
    for (const img of images) {
      URL.revokeObjectURL(img.previewUrl);
    }
    set({ ...initialState, images: [], history: get().history });
  },
}));
