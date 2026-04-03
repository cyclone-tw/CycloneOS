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

export type MobileView = "dashboard" | "chat";

interface AppState {
  activePage: SidebarPage;
  activeWorkstation: string | null;
  mobileView: MobileView;
  setActivePage: (page: SidebarPage) => void;
  setActiveWorkstation: (id: string | null) => void;
  setMobileView: (view: MobileView) => void;
  navigateTo: (page: SidebarPage, workstation?: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activePage: "overview",
  activeWorkstation: null,
  mobileView: "dashboard",
  setActivePage: (page) => set({ activePage: page, activeWorkstation: null, mobileView: "dashboard" }),
  setActiveWorkstation: (id) => set({ activeWorkstation: id }),
  setMobileView: (view) => set({ mobileView: view }),
  navigateTo: (page, workstation = null) =>
    set({ activePage: page, activeWorkstation: workstation, mobileView: "dashboard" }),
}));
