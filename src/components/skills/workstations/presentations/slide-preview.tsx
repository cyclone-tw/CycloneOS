"use client";
import { useEffect, useRef, useMemo, useCallback, useState } from "react";
import { Download, RotateCcw, Play, Printer, FileText, Upload, Loader2 } from "lucide-react";
import { usePresentationsStore } from "@/stores/presentations-store";
import { outlineToHtml, outlineToSpeakerNotes } from "@/lib/presentations-utils";

export function SlidePreview() {
  const { getActiveSession, setStatus } = usePresentationsStore();
  const session = getActiveSession();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isPushing, setIsPushing] = useState(false);

  const slides = session?.outline.slides ?? [];
  const selectedId = session?.selectedSlideId;
  const selectedIndex = slides.findIndex((s) => s.id === selectedId);

  const outline = session?.outline;
  const slideSettings = session?.slideSettings;
  const html = useMemo(() => {
    if (!outline || outline.slides.length === 0) return "";
    return outlineToHtml(outline, undefined, slideSettings);
  }, [outline, slideSettings]);

  // Ref so onLoad callback always reads latest selectedIndex
  const selectedIndexRef = useRef(selectedIndex);
  selectedIndexRef.current = selectedIndex;

  // When iframe finishes loading new HTML, navigate to the selected slide.
  // Nav JS init shows slide 0 but suppresses notifyParent, so selectedSlideId
  // in the store stays correct. This message overrides to the right slide.
  const handleIframeLoad = useCallback(() => {
    const idx = selectedIndexRef.current;
    if (idx >= 0) {
      iframeRef.current?.contentWindow?.postMessage({ goToSlide: idx }, "*");
    }
  }, []);

  // When user clicks a different slide in sidebar (no iframe reload needed)
  useEffect(() => {
    if (!iframeRef.current || selectedIndex < 0) return;
    iframeRef.current.contentWindow?.postMessage({ goToSlide: selectedIndex }, "*");
  }, [selectedIndex]);

  // Listen for iframe messages (slideChanged, modeChanged)
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.slideChanged !== undefined && session) {
        const idx = e.data.slideChanged as number;
        const sorted = [...session.outline.slides].sort((a, b) => a.order - b.order);
        const slide = sorted[idx];
        if (slide) {
          usePresentationsStore.getState().setSelectedSlide(slide.id);
        }
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [session]);

  if (!session || slides.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-cy-muted text-sm">
        生成大綱後會在此顯示預覽
      </div>
    );
  }

  const aspectClass = session.aspectRatio === "16:9" ? "aspect-video" : "aspect-[4/3]";

  const handleExportHtml = () => {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${session.outline.title || "presentation"}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  const handlePresent = () => {
    iframeRef.current?.contentWindow?.postMessage({ setMode: "present" }, "*");
  };

  const handleExportPDF = () => {
    if (!html) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("請允許此網站的彈出式視窗以匯出 PDF");
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.addEventListener("load", () => {
      printWindow.print();
    });
  };

  const handleExportNotes = () => {
    if (!session) return;
    const md = outlineToSpeakerNotes(session.outline);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${session.outline.title || "presentation"}-notes.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  const handlePushGitHub = async () => {
    if (!session || isPushing) return;
    setIsPushing(true);
    try {
      const res = await fetch("/api/presentations/push-github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: session.outline.title || "presentation",
          html,
          speakerNotes: outlineToSpeakerNotes(session.outline),
        }),
      });
      const result = await res.json();
      if (result.success) {
        alert(`已推送到 GitHub：${result.path}`);
      } else {
        alert(`推送失敗：${result.error}`);
      }
    } catch (e) {
      alert(`推送失敗：${e instanceof Error ? e.message : "未知錯誤"}`);
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-cy-border">
        <span className="text-xs text-cy-muted">
          {selectedIndex >= 0 ? `第 ${selectedIndex + 1} / ${slides.length} 頁` : `共 ${slides.length} 頁`}
        </span>
        <div className="flex gap-1.5">
          <button
            onClick={() => setStatus("configuring")}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-cy-muted hover:bg-cy-input/50 hover:text-cy-text transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            重新生成
          </button>
          <button
            onClick={handleExportHtml}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-cy-accent bg-cy-accent/10 hover:bg-cy-accent/20 transition-colors"
          >
            <Download className="h-3 w-3" />
            匯出 HTML
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-cy-muted hover:bg-cy-input/50 hover:text-cy-text transition-colors"
            title="匯出 PDF（列印）"
          >
            <Printer className="h-3 w-3" />
            PDF
          </button>
          <button
            onClick={handleExportNotes}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-cy-muted hover:bg-cy-input/50 hover:text-cy-text transition-colors"
            title="匯出講稿"
          >
            <FileText className="h-3 w-3" />
            講稿
          </button>
          <button
            onClick={handlePushGitHub}
            disabled={isPushing}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-cy-muted hover:bg-cy-input/50 hover:text-cy-text transition-colors disabled:opacity-40"
            title="推送到 GitHub"
          >
            {isPushing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            GitHub
          </button>
          <button
            onClick={handlePresent}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs bg-blue-600/80 hover:bg-blue-600 text-white transition-colors"
            title="進入演示模式"
          >
            <Play className="h-3 w-3" />
            演示
          </button>
        </div>
      </div>
      {/* Preview — fill available space, maintain aspect ratio */}
      <div className="flex-1 flex items-center justify-center p-2 min-h-0">
        <div className={`${aspectClass} w-full bg-black rounded-lg overflow-hidden shadow-lg`} style={{ maxHeight: "100%" }}>
          <iframe
            ref={iframeRef}
            srcDoc={html}
            onLoad={handleIframeLoad}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin"
            allowFullScreen
            title="Slide Preview"
          />
        </div>
      </div>
    </div>
  );
}
