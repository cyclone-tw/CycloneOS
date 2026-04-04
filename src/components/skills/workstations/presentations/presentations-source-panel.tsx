"use client";

import { useState } from "react";
import { Play, Loader2, ClipboardPaste, Search, FolderOpen } from "lucide-react";
import { usePresentationsStore, type SlideOutline } from "@/stores/presentations-store";
import { useAgentStore } from "@/stores/agent-store";
import { SharedSourceList } from "../shared/source-list";
import { SharedSourcePickerModal } from "../shared/source-picker-modal";
import { RendererPicker } from "./renderer-picker";
import { ThemePicker } from "./theme-picker";

type ActivePanel = null | "paste" | "research";

const OUTPUTS_PATH =
  "~/Library/CloudStorage/GoogleDrive-user@gmail.com/我的雲端硬碟/Obsidian-Cyclone/CycloneOS";

export function PresentationsSourcePanel() {
  const {
    getActiveSession,
    addSources,
    removeSource,
    setStatus,
    setOutline,
    setError,
    setClaudeSessionId,
    setAspectRatio,
  } = usePresentationsStore();

  const session = getActiveSession();
  const [isGenerating, setIsGenerating] = useState(false);
  const [instructions, setInstructions] = useState("");

  // New source panels
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [pasteText, setPasteText] = useState("");
  const [pasteCount, setPasteCount] = useState(0);
  const [researchQuery, setResearchQuery] = useState("");
  const [isResearching, setIsResearching] = useState(false);
  const [importResearchOpen, setImportResearchOpen] = useState(false);
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const { provider, model } = useAgentStore();

  const sources = session?.sources ?? [];
  const aspectRatio = session?.aspectRatio ?? "16:9";
  const canGenerate = !isGenerating;

  const togglePanel = (panel: ActivePanel) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  };

  const handlePasteSubmit = () => {
    if (!pasteText.trim()) return;
    const num = pasteCount + 1;
    setPasteCount(num);
    addSources([
      {
        id: crypto.randomUUID(),
        type: "text",
        name: `貼上文字 #${num}`,
        path: "",
        isDirectory: false,
        textContent: pasteText.trim(),
      },
    ]);
    setPasteText("");
  };

  const handleResearchSubmit = async () => {
    if (!researchQuery.trim() || isResearching) return;
    setIsResearching(true);
    try {
      const res = await fetch("/api/presentations/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: researchQuery.trim(), provider, model }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Research failed" }));
        setError(err.error || `HTTP ${res.status}`);
        return;
      }
      const data = await res.json();
      addSources([
        {
          id: crypto.randomUUID(),
          type: "research",
          name: `研究：${researchQuery.trim()}`,
          path: "",
          isDirectory: false,
          textContent: data.content,
          researchQuery: researchQuery.trim(),
        },
      ]);
      setResearchQuery("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Research failed");
    } finally {
      setIsResearching(false);
    }
  };

  const isUrl = (text: string) => {
    try {
      const url = new URL(text.trim());
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  };

  const handleFetchUrl = async () => {
    const url = pasteText.trim();
    if (!isUrl(url) || isFetchingUrl) return;
    setIsFetchingUrl(true);
    try {
      const res = await fetch("/api/presentations/fetch-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Fetch failed" }));
        setError(err.error || `HTTP ${res.status}`);
        return;
      }
      const data = await res.json();
      addSources([
        {
          id: crypto.randomUUID(),
          type: "url",
          name: `URL：${new URL(url).hostname}`,
          path: "",
          isDirectory: false,
          textContent: data.content,
          sourceUrl: url,
        },
      ]);
      setPasteText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fetch URL failed");
    } finally {
      setIsFetchingUrl(false);
    }
  };

  const handleGenerate = async () => {
    if (!session || !canGenerate) return;
    setIsGenerating(true);
    setStatus("generating");
    setError(null);

    try {
      const res = await fetch("/api/presentations/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sources: session.sources,
          instructions,
          theme: session.outline.theme,
          renderer: session.renderer,
          aspectRatio: session.aspectRatio,
          claudeSessionId: session.sessionProvider === provider ? session.claudeSessionId : null,
          provider,
          model,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        setError(err.error || `HTTP ${res.status}`);
        setStatus("configuring");
        setIsGenerating(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError("No response stream");
        setStatus("configuring");
        setIsGenerating(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse complete SSE events (split on double newline)
        const parts = buffer.split("\n\n");
        // The last part may be incomplete — keep it in buffer
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const lines = part.split("\n");
          let eventType = "";
          let dataLine = "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              dataLine = line.slice(6).trim();
            }
          }

          if (!dataLine) continue;

          try {
            if (eventType === "session") {
              const parsed = JSON.parse(dataLine);
              if (parsed.sessionId) setClaudeSessionId(parsed.sessionId, provider);
            } else if (eventType === "outline") {
              const parsed = JSON.parse(dataLine);
              const outline = (parsed.outline ?? parsed) as SlideOutline;
              // Preserve the user-selected theme — Claude's response doesn't include it
              if (!outline.theme && session.outline.theme) {
                outline.theme = session.outline.theme;
              }
              setOutline(outline); // also sets status → "editing"
            } else if (eventType === "error") {
              const parsed = JSON.parse(dataLine);
              setError(parsed.message || "Generation failed");
              setStatus("configuring");
            } else if (eventType === "done") {
              // Stream finished
            } else if (!eventType) {
              // Fallback: some servers emit data-only lines (no event:)
              try {
                const parsed = JSON.parse(dataLine);
                if (parsed.type === "session" && parsed.sessionId) {
                  setClaudeSessionId(parsed.sessionId, provider);
                } else if (parsed.type === "outline") {
                  const ol = parsed.outline as SlideOutline;
                  if (!ol.theme && session.outline.theme) {
                    ol.theme = session.outline.theme;
                  }
                  setOutline(ol);
                } else if (parsed.type === "error") {
                  setError(parsed.content || "Generation failed");
                  setStatus("configuring");
                }
              } catch {
                // skip unparseable data lines
              }
            }
          } catch {
            // skip JSON parse errors
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setStatus("configuring");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      {/* Source list */}
      <SharedSourceList
        sources={sources}
        onAddSources={addSources}
        onRemoveSource={removeSource}
      />

      {/* Extra source buttons */}
      <div className="flex gap-1.5">
        <button
          onClick={() => togglePanel("paste")}
          className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
            activePanel === "paste"
              ? "bg-cy-accent/15 text-cy-accent border border-cy-accent/30"
              : "bg-cy-input/30 text-cy-muted hover:text-cy-text border border-cy-border"
          }`}
        >
          <ClipboardPaste className="h-3 w-3" />
          貼上文字
        </button>
        <button
          onClick={() => togglePanel("research")}
          className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
            activePanel === "research"
              ? "bg-cy-accent/15 text-cy-accent border border-cy-accent/30"
              : "bg-cy-input/30 text-cy-muted hover:text-cy-text border border-cy-border"
          }`}
        >
          <Search className="h-3 w-3" />
          研究
        </button>
        <button
          onClick={() => setImportResearchOpen(true)}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-cy-border bg-cy-input/30 py-1.5 text-xs font-medium text-cy-muted hover:text-cy-text transition-colors"
        >
          <FolderOpen className="h-3 w-3" />
          匯入研究
        </button>
      </div>

      {/* Paste text panel */}
      {activePanel === "paste" && (
        <div className="space-y-2 border-t border-cy-border/50 pt-2">
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="貼上文字內容作為簡報來源..."
            rows={4}
            className="w-full rounded-lg border border-cy-border bg-cy-input/50 px-3 py-2 text-sm text-cy-text placeholder:text-cy-muted/50 focus:border-cy-accent/50 focus:outline-none resize-none"
          />
          {pasteText.trim() && isUrl(pasteText) && (
            <div className="flex items-center gap-2 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-2">
              <span className="text-sm">🔗</span>
              <div className="flex-1">
                <p className="text-xs font-medium text-purple-300">偵測到 URL</p>
                <p className="text-[10px] text-cy-muted">要自動擷取網頁內容嗎？</p>
              </div>
              <button
                onClick={handleFetchUrl}
                disabled={isFetchingUrl}
                className="rounded-md bg-purple-600/80 px-3 py-1 text-xs font-medium text-white hover:bg-purple-600 disabled:opacity-50"
              >
                {isFetchingUrl ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  "擷取"
                )}
              </button>
            </div>
          )}
          <button
            onClick={handlePasteSubmit}
            disabled={!pasteText.trim()}
            className={`w-full rounded-lg py-1.5 text-xs font-medium transition-colors ${
              pasteText.trim()
                ? "bg-cy-accent/15 text-cy-accent hover:bg-cy-accent/25"
                : "bg-cy-input/30 text-cy-muted cursor-not-allowed"
            }`}
          >
            加入來源
          </button>
        </div>
      )}

      {/* Research panel */}
      {activePanel === "research" && (
        <div className="space-y-2 border-t border-cy-border/50 pt-2">
          <div className="flex gap-1.5">
            <input
              value={researchQuery}
              onChange={(e) => setResearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleResearchSubmit()}
              placeholder="輸入研究主題..."
              className="flex-1 rounded-lg border border-cy-border bg-cy-input/50 px-3 py-1.5 text-sm text-cy-text placeholder:text-cy-muted/50 focus:border-cy-accent/50 focus:outline-none"
              disabled={isResearching}
            />
            <button
              onClick={handleResearchSubmit}
              disabled={!researchQuery.trim() || isResearching}
              className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                researchQuery.trim() && !isResearching
                  ? "bg-cy-accent/15 text-cy-accent hover:bg-cy-accent/25"
                  : "bg-cy-input/30 text-cy-muted cursor-not-allowed"
              }`}
            >
              {isResearching ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  研究中...
                </>
              ) : (
                "搜尋"
              )}
            </button>
          </div>
        </div>
      )}

      {/* Import Research file picker */}
      <SharedSourcePickerModal
        open={importResearchOpen}
        onClose={() => setImportResearchOpen(false)}
        onAddSources={addSources}
        initialPath={OUTPUTS_PATH}
        initialTab="local"
        sourceTypeOverride="obsidian"
      />

      {/* Renderer picker */}
      <RendererPicker />

      {/* Theme picker */}
      <ThemePicker />

      {/* Instructions */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-cy-muted">簡報指示</label>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="例：做一份 5 頁的 AI 教育應用簡報"
          rows={3}
          className="w-full rounded-lg border border-cy-border bg-cy-input/50 px-3 py-2 text-sm text-cy-text placeholder:text-cy-muted/50 focus:border-cy-accent/50 focus:outline-none resize-none"
        />
      </div>

      {/* Aspect ratio toggle */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-cy-muted">畫面比例</label>
        <div className="flex gap-1.5">
          <button
            onClick={() => setAspectRatio("16:9")}
            className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
              aspectRatio === "16:9"
                ? "bg-cy-accent/15 text-cy-accent border border-cy-accent/30"
                : "bg-cy-input/50 text-cy-muted hover:text-cy-text border border-transparent"
            }`}
          >
            16:9
          </button>
          <button
            onClick={() => setAspectRatio("4:3")}
            className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
              aspectRatio === "4:3"
                ? "bg-cy-accent/15 text-cy-accent border border-cy-accent/30"
                : "bg-cy-input/50 text-cy-muted hover:text-cy-text border border-transparent"
            }`}
          >
            4:3
          </button>
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={!canGenerate}
        className={`mt-auto flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all ${
          canGenerate
            ? "bg-cy-accent text-cy-bg hover:bg-cy-accent/90"
            : "bg-cy-input/50 text-cy-muted cursor-not-allowed"
        }`}
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            生成中...
          </>
        ) : (
          <>
            <Play className="h-4 w-4" />
            生成大綱
          </>
        )}
      </button>
    </div>
  );
}
