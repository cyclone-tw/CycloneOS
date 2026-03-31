// dashboard/src/stores/drive-store.ts
import { create } from "zustand";
import type { FileEntry } from "@/lib/providers/types";

interface DriveState {
  activeAccount: string;
  currentPath: string;
  files: FileEntry[];
  selectedFile: FileEntry | null;
  isLoading: boolean;
  searchQuery: string;
  searchResults: FileEntry[] | null;
  error: string | null;

  setActiveAccount: (accountId: string) => void;
  setCurrentPath: (path: string) => void;
  setFiles: (files: FileEntry[]) => void;
  setSelectedFile: (file: FileEntry | null) => void;
  setIsLoading: (loading: boolean) => void;
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: FileEntry[] | null) => void;
  setError: (error: string | null) => void;
}

export const useDriveStore = create<DriveState>((set) => ({
  activeAccount: "personal",
  currentPath: ".",
  files: [],
  selectedFile: null,
  isLoading: false,
  searchQuery: "",
  searchResults: null,
  error: null,

  setActiveAccount: (accountId) =>
    set({ activeAccount: accountId, currentPath: ".", files: [], selectedFile: null, searchQuery: "", searchResults: null, error: null }),
  setCurrentPath: (path) => set({ currentPath: path, selectedFile: null, searchResults: null }),
  setFiles: (files) => set({ files }),
  setSelectedFile: (file) => set({ selectedFile: file }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSearchResults: (results) => set({ searchResults: results }),
  setError: (error) => set({ error }),
}));
