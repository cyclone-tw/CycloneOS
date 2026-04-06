"use client";

import { useCallback, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { useAgentStore } from "@/stores/agent-store";
import { useSocialStore } from "@/stores/social-store";
import { SourceInput } from "./source-input";
import { ImageUploader } from "./image-uploader";
import { PlatformSelector } from "./platform-selector";
import { PlatformPreview } from "./platform-preview";
import { PostHistory } from "./post-history";
import { WorkstationLLMControls } from "../shared/workstation-llm-controls";

export function SocialWorkstation() {
  const { setActiveWorkstation } = useAppStore();
  const { provider, model } = useAgentStore();
  const {
    sourceText,
    platforms,
    tone,
    setGenerating,
    setGeneratedContents,
    setError,
    error,
  } = useSocialStore();

  // Resizable left panel
  const [leftWidth, setLeftWidth] = useState(340);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const handleGenerate = useCallback(async () => {
    if (!sourceText.trim()) {
      setError("請輸入素材文字");
      return;
    }
    if (platforms.length === 0) {
      setError("請至少選擇一個平台");
      return;
    }

    setGenerating(true);
    setError(null);
    setGeneratedContents(null);

    try {
      const response = await fetch("/api/social/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sourceText, platforms, tone, provider, model }),
      });

      if (!response.body) {
        setError("伺服器未回傳資料流");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
            continue;
          }
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (currentEvent === "result") {
                setGeneratedContents(data);
              } else if (currentEvent === "error" && data.message) {
                setError(data.message);
              }
            } catch {
              // Partial JSON, ignore
            }
            currentEvent = "";
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失敗，請再試一次");
    } finally {
      setGenerating(false);
    }
  }, [sourceText, platforms, tone, provider, model, setGenerating, setError, setGeneratedContents]);

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
        <span className="text-lg">📱</span>
        <h1 className="text-lg font-bold text-cy-text">社群發文模組</h1>
        <WorkstationLLMControls />
        {error && (
          <span className="rounded bg-cy-error/20 px-2 py-0.5 text-xs text-cy-error">
            {error}
          </span>
        )}
      </div>

      {/* Main content: resizable left/right split */}
      <div ref={containerRef} className="flex flex-1 overflow-hidden mt-3" style={{ minHeight: 0 }}>
        {/* Left panel */}
        <div className="shrink-0 overflow-y-auto space-y-4" style={{ width: leftWidth }}>
          <SourceInput />
          <ImageUploader />
          <PlatformSelector onGenerate={handleGenerate} />
          <PostHistory />
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={handleMouseDown}
          className="group flex w-2 shrink-0 cursor-col-resize items-center justify-center hover:bg-cy-accent/10 transition-colors"
        >
          <div className="h-8 w-0.5 rounded-full bg-cy-muted/20 group-hover:bg-cy-accent/50 transition-colors" />
        </div>

        {/* Right panel: PlatformPreview */}
        <div className="flex-1 overflow-hidden border border-cy-border rounded-md" style={{ minWidth: 0 }}>
          <PlatformPreview />
        </div>
      </div>
    </div>
  );
}
