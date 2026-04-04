"use client";

import { ArrowLeft } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { FeloChat } from "./felo-chat";
import { FeloOutputPanel } from "./felo-output-panel";
import { WorkstationLLMControls } from "../shared/workstation-llm-controls";

export function FeloWorkstation() {
  const { setActiveWorkstation } = useAppStore();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-cy-border/40 px-4 py-3">
        <button
          onClick={() => setActiveWorkstation(null)}
          className="text-cy-muted hover:text-cy-text transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="text-lg">🤖</span>
        <div>
          <h2 className="text-sm font-semibold text-cy-text">
            Felo AI 工作站
          </h2>
          <p className="text-[11px] text-cy-muted">
            SuperAgent 對話・生圖・Web 擷取・Research
          </p>
        </div>
        <WorkstationLLMControls />
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0">
          <FeloChat />
        </div>
        <div className="w-64 border-l border-cy-border/30 flex flex-col">
          <FeloOutputPanel />
        </div>
      </div>
    </div>
  );
}
