"use client";
import { useEffect, useRef, useMemo, useCallback, useState } from "react";
import { Download, RotateCcw, Play, Printer, FileText, Upload, Loader2, ExternalLink, X } from "lucide-react";
import { usePresentationsStore } from "@/stores/presentations-store";
import { outlineToHtml, outlineToSpeakerNotes } from "@/lib/presentations-utils";

export function SlidePreview() {
  const { getActiveSession, setStatus } = usePresentationsStore();
  const session = getActiveSession();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isPushing, setIsPushing] = useState(false);
  const [showPushDialog, setShowPushDialog] = useState(false);
  const [pushFolderName, setPushFolderName] = useState("");
  const [pushResult, setPushResult] = useState<{ url: string; folder: string } | null>(null);

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

  const openPushDialog = () => {
    if (!session) return;
    const title = session.outline.title || "presentation";
    setPushFolderName(slugify(title));
    setPushResult(null);
    setShowPushDialog(true);
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
          folderName: pushFolderName.trim() || undefined,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setPushResult({ url: result.url, folder: result.folder });
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
            onClick={openPushDialog}
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

      {/* Push to GitHub dialog */}
      {showPushDialog && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50">
          <div className="w-[380px] rounded-xl border border-cy-border bg-cy-card p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-cy-text">推送到 GitHub Pages</h3>
              <button onClick={() => setShowPushDialog(false)} className="text-cy-muted hover:text-cy-text">
                <X className="h-4 w-4" />
              </button>
            </div>

            {pushResult ? (
              <div className="space-y-3">
                <p className="text-xs text-green-400">推送成功！</p>
                <div className="rounded-lg bg-cy-bg/60 p-3">
                  <p className="text-[10px] text-cy-muted mb-1">GitHub Pages URL</p>
                  <a
                    href={pushResult.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-cy-accent hover:text-cy-accent/80 break-all"
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    {pushResult.url}
                  </a>
                </div>
                <p className="text-[10px] text-cy-muted">
                  GitHub Pages 部署約需 1-2 分鐘
                </p>
                <button
                  onClick={() => setShowPushDialog(false)}
                  className="w-full rounded-lg bg-cy-accent/15 px-3 py-1.5 text-xs text-cy-accent hover:bg-cy-accent/25 transition-colors"
                >
                  完成
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] text-cy-muted mb-1">資料夾名稱（URL 路徑）</label>
                  <input
                    value={pushFolderName}
                    onChange={(e) => setPushFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && pushFolderName.trim()) {
                        e.preventDefault();
                        handlePushGitHub();
                      }
                    }}
                    placeholder="my-presentation"
                    autoFocus
                    className="w-full rounded-lg border border-cy-border bg-cy-input/50 px-3 py-1.5 text-sm text-cy-text placeholder:text-cy-muted/50 focus:border-cy-accent/50 focus:outline-none"
                  />
                  <p className="mt-1 text-[10px] text-cy-muted">
                    URL：https://cyclone-tw.github.io/slides/<span className="text-cy-text/70">{pushFolderName || "..."}</span>/
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowPushDialog(false)}
                    className="flex-1 rounded-lg px-3 py-1.5 text-xs text-cy-muted hover:bg-cy-input/40 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handlePushGitHub}
                    disabled={isPushing || !pushFolderName.trim()}
                    className="flex-1 rounded-lg bg-cy-accent/15 px-3 py-1.5 text-xs text-cy-accent hover:bg-cy-accent/25 transition-colors disabled:opacity-40"
                  >
                    {isPushing ? (
                      <span className="flex items-center justify-center gap-1.5">
                        <Loader2 className="h-3 w-3 animate-spin" /> 推送中...
                      </span>
                    ) : (
                      "推送"
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
