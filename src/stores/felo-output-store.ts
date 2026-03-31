// src/stores/felo-output-store.ts

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { FeloOutput } from "@/lib/felo/types";

interface FeloOutputState {
  outputs: FeloOutput[];
  liveDocId: string | null;

  addOutput: (output: FeloOutput) => void;
  removeOutput: (id: string) => void;
  getByType: (type: FeloOutput["type"]) => FeloOutput[];
  getRecent: (limit?: number) => FeloOutput[];
  setLiveDocId: (id: string) => void;
}

export const useFeloOutputStore = create<FeloOutputState>()(
  persist(
    (set, get) => ({
      outputs: [],
      liveDocId: null,

      addOutput: (output) =>
        set({ outputs: [output, ...get().outputs] }),

      removeOutput: (id) =>
        set({ outputs: get().outputs.filter((o) => o.id !== id) }),

      getByType: (type) => get().outputs.filter((o) => o.type === type),

      getRecent: (limit = 20) => get().outputs.slice(0, limit),

      setLiveDocId: (id) => set({ liveDocId: id }),
    }),
    {
      name: "cycloneos-felo-outputs",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
