// dashboard/src/stores/presentations-store.ts

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { SourceItem } from "./documents-store";
import { ANIMATION_DEFAULTS } from "@/lib/slide-animation-defaults";
import type { AgentCliProvider } from "@/types/chat";

// --- Types ---

export type RendererType = "html" | "canva" | "felo";
export type SessionStatus = "configuring" | "generating" | "editing" | "exporting";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  targetSlideId?: string;
}

export type SlideType =
  | "cover" | "section-divider" | "content" | "two-column"
  | "dataviz" | "quote" | "story-cards" | "closing"
  | "image-showcase" | "icon-grid" | "statement" | "comparison" | "title-cards";

export interface ContentItem {
  label: string;
  value?: string;
  color?: string;
  desc?: string;
}

export interface ContentBlock {
  title?: string;
  items?: ContentItem[];
  body?: string;
}

export interface BackgroundImage {
  url?: string;
  prompt?: string;
  overlay?: "dark" | "light" | "gradient";
  position?: "cover" | "contain" | "left" | "right";
}

export interface CustomParams {
  titleScale: number;    // 0.5 ~ 2.0, default 1.0
  subtitleScale: number; // 0.5 ~ 2.0, default 1.0
  bodyScale: number;     // 0.5 ~ 2.0
  cardScale: number;     // 0.5 ~ 2.0
  spacingScale: number;  // 0.5 ~ 2.0
  badgeScale: number;    // 0.5 ~ 2.0, default 1.0
}

export type AnimationLevel = "none" | "subtle" | "moderate" | "dynamic";

export interface SlideAnimation {
  entrance: "fade" | "slide-up" | "slide-left" | "zoom";
  fragmentStyle: "fade" | "slide-up" | "slide-left" | "flip" | "zoom";
  speed: "slow" | "normal" | "fast";
}

// --- V3.2: Layout Control + Image Split ---

export type BadgePosition =
  | "top-left" | "top-center" | "top-right"
  | "bottom-left" | "bottom-center" | "bottom-right";

export type TextAlign = "left" | "center" | "right";

export type SplitMode = "default" | "split-horizontal" | "split-vertical" | "image-overlay";

export interface SlideImage {
  url?: string;
  base64?: string;
  prompt?: string;
  overlay?: "dark" | "light" | "gradient";
  overlayOpacity?: number;  // 0.0 to 1.0, default depends on overlay type
  fit?: "cover" | "contain";
}

export interface SlideLayout {
  mode: SplitMode;
  imagePosition?: "left" | "right" | "top" | "bottom";
  splitRatio?: number;
  image?: SlideImage;
}

export interface SlideSettings {
  cardStyle: "solid" | "glass";
  customParams: CustomParams;
  animationLevel: AnimationLevel;
}

export const DEFAULT_CUSTOM_PARAMS: CustomParams = {
  titleScale: 1.0,
  subtitleScale: 1.0,
  bodyScale: 1.0,
  cardScale: 1.0,
  spacingScale: 1.0,
  badgeScale: 1.0,
};

export const DEFAULT_SLIDE_SETTINGS: SlideSettings = {
  cardStyle: "solid",
  customParams: DEFAULT_CUSTOM_PARAMS,
  animationLevel: "moderate",
};

export interface SlideContent {
  slideType: SlideType;
  variant: string;
  title?: string;
  subtitle?: string;
  body?: string;
  badge?: string;
  items?: ContentItem[];
  columns?: [ContentBlock, ContentBlock];
  quote?: { text: string; author?: string; source?: string };
  cards?: { title: string; body: string; icon?: string; imageUrl?: string }[];
  bigNumber?: { value: string; label: string };
  stats?: { value: string; label: string }[];
  footnote?: string;
  imagePrompt?: string;
  backgroundImage?: BackgroundImage;
  layout?: SlideLayout;
  badgePosition?: BadgePosition;
  textAlign?: TextAlign;

  // New for image-showcase
  images?: { url: string; caption?: string; fit?: "cover" | "contain" }[];

  // New for title-cards
  bannerImage?: { url: string; fit?: "cover" | "contain" };

  // New for statement
  highlightLines?: number[];
}

export interface SlideDefinition {
  id: string;
  order: number;
  content: SlideContent;
  animation?: SlideAnimation;
  speakerNotes?: string;
  customParams?: Partial<CustomParams>;
}

export interface SlideOutline {
  title: string;
  theme?: string;
  slides: SlideDefinition[];
}

export type RendererState =
  | { type: "html"; html?: string }
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
  slideSettings: SlideSettings;
  claudeSessionId?: string;
  sessionProvider?: AgentCliProvider | null;
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
  reorderSlides: (orderedIds: string[]) => void;
  addSlide: (slideType: SlideType, afterSlideId?: string) => void;
  setSlideLayout: (slideId: string, slideType: SlideType, variant: string) => void;
  updateSlideContent: (slideId: string, updates: Partial<SlideContent>) => void;
  deleteSlide: (slideId: string) => void;
  setSelectedSlide: (slideId: string | null) => void;

  // Theme (does NOT change status — safe to call from configuring mode)
  setTheme: (themeId: string) => void;

  // Slide settings
  setCardStyle: (style: "solid" | "glass") => void;
  setCustomParam: (key: keyof CustomParams, value: number) => void;
  resetCustomParams: () => void;
  setSlideCustomParam: (slideId: string, key: keyof CustomParams, value: number) => void;
  resetSlideCustomParams: (slideId: string) => void;
  setAnimationLevel: (level: AnimationLevel) => void;
  setSlideAnimation: (slideId: string, animation: Partial<SlideAnimation>) => void;
  resetSlideAnimation: (slideId: string) => void;

  // V3.2: Layout & position
  setSlideImageLayout: (slideId: string, layout: Partial<SlideLayout>) => void;
  setSlideImage: (slideId: string, image: SlideImage) => void;
  removeSlideImage: (slideId: string) => void;
  setBadgePosition: (slideId: string, position: BadgePosition) => void;
  setTextAlign: (slideId: string, align: TextAlign) => void;
  updateSlideField: (slideId: string, field: "speakerNotes", value: string) => void;

  // Renderer
  setRenderer: (renderer: RendererType) => void;
  setRendererState: (state: RendererState) => void;
  setAspectRatio: (ratio: "16:9" | "4:3") => void;

  // Chat
  addChatMessage: (msg: Omit<ChatMessage, "id" | "timestamp">) => void;
  setClaudeSessionId: (id: string, provider: AgentCliProvider) => void;
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

function getDefaultVariant(slideType: SlideType): string {
  const defaults: Record<SlideType, string> = {
    cover: "gradient",
    "section-divider": "dark",
    content: "bullets",
    "two-column": "text-text",
    dataviz: "horizontal-bars",
    quote: "simple",
    "story-cards": "grid-3",
    closing: "thank-you",
    "image-showcase": "single",
    "icon-grid": "grid-3",
    statement: "centered",
    comparison: "vs-split",
    "title-cards": "banner-3",
  };
  return defaults[slideType];
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
          renderer: "html",
          rendererState: { type: "html" },
          chatHistory: [],
          aspectRatio: "16:9",
          selectedSlideId: null,
          slideSettings: { ...DEFAULT_SLIDE_SETTINGS, customParams: { ...DEFAULT_CUSTOM_PARAMS } },
          sessionProvider: null,
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

      reorderSlides: (orderedIds) =>
        set((state) => ({
          sessions: updateSession(state.sessions, state.activeSessionId, (s) => {
            const slideMap = new Map(s.outline.slides.map((sl) => [sl.id, sl]));
            const reordered = orderedIds
              .map((id, i) => {
                const slide = slideMap.get(id);
                return slide ? ({ ...slide, order: i } as SlideDefinition) : null;
              })
              .filter((sl): sl is SlideDefinition => sl !== null);
            return { ...s, outline: { ...s.outline, slides: reordered } };
          }),
        })),

      addSlide: (slideType, afterSlideId) =>
        set((state) => ({
          sessions: updateSession(state.sessions, state.activeSessionId, (s) => {
            const newSlide: SlideDefinition = {
              id: generateId(),
              order: s.outline.slides.length,
              content: { slideType, variant: getDefaultVariant(slideType) },
            };
            const slides = [...s.outline.slides];
            if (afterSlideId) {
              const idx = slides.findIndex((sl) => sl.id === afterSlideId);
              slides.splice(idx + 1, 0, newSlide);
            } else {
              slides.push(newSlide);
            }
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

      setSlideLayout: (slideId, slideType, variant) =>
        set((state) => ({
          sessions: updateSession(state.sessions, state.activeSessionId, (s) => ({
            ...s,
            outline: {
              ...s.outline,
              slides: s.outline.slides.map((sl) =>
                sl.id === slideId
                  ? { ...sl, content: { ...sl.content, slideType, variant } }
                  : sl
              ),
            },
          })),
        })),

      updateSlideContent: (slideId, updates) =>
        set((state) => ({
          sessions: updateSession(state.sessions, state.activeSessionId, (s) => ({
            ...s,
            outline: {
              ...s.outline,
              slides: s.outline.slides.map((sl) =>
                sl.id === slideId
                  ? { ...sl, content: { ...sl.content, ...updates } }
                  : sl
              ),
            },
          })),
        })),

      setSelectedSlide: (slideId) =>
        set((state) => ({
          sessions: updateSession(state.sessions, state.activeSessionId, (s) => ({
            ...s,
            selectedSlideId: slideId,
          })),
        })),

      setTheme: (themeId) =>
        set((state) => ({
          sessions: updateSession(state.sessions, state.activeSessionId, (s) => ({
            ...s,
            outline: { ...s.outline, theme: themeId },
          })),
        })),

      setCardStyle: (style) =>
        set((state) => ({
          sessions: updateSession(state.sessions, state.activeSessionId, (s) => ({
            ...s,
            slideSettings: { ...s.slideSettings, cardStyle: style },
          })),
        })),

      setCustomParam: (key, value) =>
        set((state) => ({
          sessions: updateSession(state.sessions, state.activeSessionId, (s) => ({
            ...s,
            slideSettings: {
              ...s.slideSettings,
              customParams: { ...s.slideSettings.customParams, [key]: value },
            },
          })),
        })),

      resetCustomParams: () =>
        set((state) => ({
          sessions: updateSession(state.sessions, state.activeSessionId, (s) => ({
            ...s,
            slideSettings: {
              ...s.slideSettings,
              customParams: { ...DEFAULT_CUSTOM_PARAMS },
            },
          })),
        })),

      setSlideCustomParam: (slideId, key, value) =>
        set((state) => ({
          sessions: updateSession(state.sessions, state.activeSessionId, (s) => ({
            ...s,
            outline: {
              ...s.outline,
              slides: s.outline.slides.map((sl) =>
                sl.id === slideId
                  ? { ...sl, customParams: { ...sl.customParams, [key]: value } }
                  : sl,
              ),
            },
          })),
        })),

      resetSlideCustomParams: (slideId) =>
        set((state) => ({
          sessions: updateSession(state.sessions, state.activeSessionId, (s) => ({
            ...s,
            outline: {
              ...s.outline,
              slides: s.outline.slides.map((sl) =>
                sl.id === slideId ? { ...sl, customParams: undefined } : sl,
              ),
            },
          })),
        })),

      setAnimationLevel: (level) =>
        set((state) => ({
          sessions: updateSession(state.sessions, state.activeSessionId, (s) => ({
            ...s,
            slideSettings: { ...s.slideSettings, animationLevel: level },
          })),
        })),

      setSlideAnimation: (slideId, animation) =>
        set((state) => ({
          sessions: updateSession(state.sessions, state.activeSessionId, (s) => ({
            ...s,
            outline: {
              ...s.outline,
              slides: s.outline.slides.map((sl) =>
                sl.id === slideId
                  ? {
                      ...sl,
                      animation: {
                        ...ANIMATION_DEFAULTS[sl.content.slideType],
                        ...sl.animation,
                        ...animation,
                      },
                    }
                  : sl
              ),
            },
          })),
        })),

      resetSlideAnimation: (slideId) =>
        set((state) => ({
          sessions: updateSession(state.sessions, state.activeSessionId, (s) => ({
            ...s,
            outline: {
              ...s.outline,
              slides: s.outline.slides.map((sl) => {
                if (sl.id !== slideId) return sl;
                const { animation: _removed, ...rest } = sl;
                return rest;
              }),
            },
          })),
        })),

      setSlideImageLayout: (slideId, layout) =>
        set((state) => ({
          sessions: updateSession(state.sessions, state.activeSessionId, (s) => ({
            ...s,
            outline: {
              ...s.outline,
              slides: s.outline.slides.map((sl) =>
                sl.id === slideId
                  ? {
                      ...sl,
                      content: {
                        ...sl.content,
                        layout: { ...(sl.content.layout ?? { mode: "default" as SplitMode }), ...layout },
                      },
                    }
                  : sl
              ),
            },
          })),
        })),

      setSlideImage: (slideId, image) =>
        set((state) => ({
          sessions: updateSession(state.sessions, state.activeSessionId, (s) => ({
            ...s,
            outline: {
              ...s.outline,
              slides: s.outline.slides.map((sl) =>
                sl.id === slideId
                  ? {
                      ...sl,
                      content: {
                        ...sl.content,
                        layout: {
                          ...(sl.content.layout ?? { mode: "split-horizontal" as SplitMode }),
                          image,
                        },
                      },
                    }
                  : sl
              ),
            },
          })),
        })),

      removeSlideImage: (slideId) =>
        set((state) => ({
          sessions: updateSession(state.sessions, state.activeSessionId, (s) => ({
            ...s,
            outline: {
              ...s.outline,
              slides: s.outline.slides.map((sl) => {
                if (sl.id !== slideId) return sl;
                const { image: _, ...restLayout } = sl.content.layout ?? { mode: "default" as SplitMode };
                return {
                  ...sl,
                  content: { ...sl.content, layout: { ...restLayout, mode: "default" as SplitMode } },
                };
              }),
            },
          })),
        })),

      setBadgePosition: (slideId, position) =>
        set((state) => ({
          sessions: updateSession(state.sessions, state.activeSessionId, (s) => ({
            ...s,
            outline: {
              ...s.outline,
              slides: s.outline.slides.map((sl) =>
                sl.id === slideId
                  ? { ...sl, content: { ...sl.content, badgePosition: position } }
                  : sl
              ),
            },
          })),
        })),

      setTextAlign: (slideId, align) =>
        set((state) => ({
          sessions: updateSession(state.sessions, state.activeSessionId, (s) => ({
            ...s,
            outline: {
              ...s.outline,
              slides: s.outline.slides.map((sl) =>
                sl.id === slideId
                  ? { ...sl, content: { ...sl.content, textAlign: align } }
                  : sl
              ),
            },
          })),
        })),

      updateSlideField: (slideId, field, value) =>
        set((state) => ({
          sessions: updateSession(state.sessions, state.activeSessionId, (s) => ({
            ...s,
            outline: {
              ...s.outline,
              slides: s.outline.slides.map((sl) =>
                sl.id === slideId ? { ...sl, [field]: value } : sl
              ),
            },
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

      setClaudeSessionId: (claudeSessionId, provider) =>
        set((state) => ({
          sessions: updateSession(state.sessions, state.activeSessionId, (s) => ({
            ...s,
            claudeSessionId,
            sessionProvider: provider,
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
