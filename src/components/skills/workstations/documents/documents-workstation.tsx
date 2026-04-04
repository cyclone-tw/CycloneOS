"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ArrowLeft } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { useDocumentsStore } from "@/stores/documents-store";
import { DocumentsSourcePanel } from "./documents-source-panel";
import { DocumentsPreview } from "./documents-preview";
import { DocumentsChat } from "./documents-chat";
import { WorkstationLLMControls } from "../shared/workstation-llm-controls";

export function DocumentsWorkstation() {
  const { setActiveWorkstation } = useAppStore();
  const { currentSession, newSession, error } = useDocumentsStore();

  // Resizable left panel
  const [leftWidth, setLeftWidth] = useState(320);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentSession) newSession();
  }, [currentSession, newSession]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = Math.max(240, Math.min(ev.clientX - rect.left, rect.width * 0.5));
      setLeftWidth(newWidth);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, []);

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 5.5rem)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-cy-border pb-3">
        <button
          onClick={() => setActiveWorkstation(null)}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-cy-muted hover:bg-cy-input/50 hover:text-cy-text transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Skills
        </button>
        <span className="text-lg">📄</span>
        <h1 className="text-lg font-bold text-cy-text">Documents 工作站</h1>
        <WorkstationLLMControls />
        {error && (
          <span className="rounded bg-cy-error/20 px-2 py-0.5 text-xs text-cy-error">
            {error}
          </span>
        )}
      </div>

      {/* Main content: resizable left/right split */}
      <div ref={containerRef} className="flex flex-1 overflow-hidden mt-3" style={{ minHeight: 0 }}>
        {/* Left: Source panel */}
        <div className="shrink-0 overflow-y-auto" style={{ width: leftWidth }}>
          <DocumentsSourcePanel />
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={handleMouseDown}
          className="group flex w-2 shrink-0 cursor-col-resize items-center justify-center hover:bg-cy-accent/10 transition-colors"
        >
          <div className="h-8 w-0.5 rounded-full bg-cy-muted/20 group-hover:bg-cy-accent/50 transition-colors" />
        </div>

        {/* Right: Preview + Chat — equal split */}
        <div className="flex flex-1 flex-col overflow-hidden" style={{ minWidth: 0 }}>
          <div className="flex-1 overflow-hidden">
            <DocumentsPreview />
          </div>
          <div className="flex-1 overflow-hidden">
            <DocumentsChat />
          </div>
        </div>
      </div>
    </div>
  );
}
