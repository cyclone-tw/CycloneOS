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
