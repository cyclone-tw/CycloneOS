"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ArrowLeft } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { usePresentationsStore } from "@/stores/presentations-store";
import { PresentationsSourcePanel } from "./presentations-source-panel";
import { OutlineEditor } from "./outline-editor";
import { SlidePreview } from "./slide-preview";
import { PresentationsChat } from "./presentations-chat";
import { StyleSettingsPanel } from "./style-settings-panel";

export function PresentationsWorkstation() {
  const { setActiveWorkstation } = useAppStore();
  const { activeSessionId, createSession, getActiveSession, error } = usePresentationsStore();
  const session = getActiveSession();

  // Resizable left panel (horizontal)
  const [leftWidth, setLeftWidth] = useState(360);
  const isDraggingH = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Resizable chat panel (vertical) — store as height from bottom
  const [chatHeight, setChatHeight] = useState(200);
  const isDraggingV = useRef(false);
  const rightPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeSessionId) createSession("新簡報");
  }, [activeSessionId, createSession]);

  // Horizontal resize (left/right)
  const handleHMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingH.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDraggingH.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = Math.max(240, Math.min(ev.clientX - rect.left, rect.width * 0.5));
      setLeftWidth(newWidth);
    };

    const handleMouseUp = () => {
      isDraggingH.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, []);

  // Vertical resize (preview/chat)
  const handleVMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingV.current = true;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDraggingV.current || !rightPanelRef.current) return;
      const rect = rightPanelRef.current.getBoundingClientRect();
      const newHeight = Math.max(100, Math.min(rect.bottom - ev.clientY, rect.height * 0.6));
      setChatHeight(newHeight);
    };

    const handleMouseUp = () => {
      isDraggingV.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, []);

  const isEditing = session?.status === "editing" || session?.status === "exporting";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isLegacy = session?.outline.slides.some((s: any) => 'blocks' in s);

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
        <span className="text-lg">📊</span>
        <h1 className="text-lg font-bold text-cy-text">簡報工作站</h1>
        {error && (
          <span className="ml-auto rounded bg-cy-error/20 px-2 py-0.5 text-xs text-cy-error">
            {error}
          </span>
        )}
      </div>

      {isLegacy && (
        <div className="bg-cy-accent/10 border border-cy-accent/30 rounded-lg px-3 py-2 text-xs text-cy-accent">
          此簡報使用舊版引擎，請重新生成以使用新版排版系統
        </div>
      )}

      {/* Main content: resizable left/right split */}
      <div ref={containerRef} className="flex flex-1 overflow-hidden mt-3" style={{ minHeight: 0 }}>
        {/* Left panel: source config or outline editor */}
        <div className="shrink-0 overflow-y-auto" style={{ width: leftWidth }}>
          {isEditing ? <OutlineEditor /> : <PresentationsSourcePanel />}
          {isEditing && <div className="px-4 pb-4"><StyleSettingsPanel /></div>}
        </div>

        {/* Horizontal resize handle */}
        <div
          onMouseDown={handleHMouseDown}
          className="group flex w-2 shrink-0 cursor-col-resize items-center justify-center hover:bg-cy-accent/10 transition-colors"
        >
          <div className="h-8 w-0.5 rounded-full bg-cy-muted/20 group-hover:bg-cy-accent/50 transition-colors" />
        </div>

        {/* Right panel: slide preview + resizable chat */}
        <div ref={rightPanelRef} className="flex flex-1 flex-col overflow-hidden" style={{ minWidth: 0 }}>
          {/* Slide preview — takes remaining space */}
          <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
            <SlidePreview />
          </div>

          {/* Vertical resize handle */}
          <div
            onMouseDown={handleVMouseDown}
            className="group flex h-2 shrink-0 cursor-row-resize items-center justify-center hover:bg-cy-accent/10 transition-colors"
          >
            <div className="w-8 h-0.5 rounded-full bg-cy-muted/20 group-hover:bg-cy-accent/50 transition-colors" />
          </div>

          {/* Chat panel — resizable height */}
          <div className="shrink-0 overflow-hidden" style={{ height: chatHeight }}>
            <PresentationsChat />
          </div>
        </div>
      </div>
    </div>
  );
}
