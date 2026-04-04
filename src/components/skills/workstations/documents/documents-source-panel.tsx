"use client";

import { useState } from "react";
import { Play, Loader2, Sparkles } from "lucide-react";
import { useDocumentsStore } from "@/stores/documents-store";
import { useAgentStore } from "@/stores/agent-store";
import { cleanClaudeOutput } from "@/lib/documents-utils";
import { SourceList } from "./source-list";
import { OutputConfig } from "./output-config";

export function DocumentsSourcePanel() {
  const { currentSession, isProcessing, setProcessing, appendOutputContent, setOutputContent, setError, setClaudeSessionId } =
    useDocumentsStore();
  const [taskDesc, setTaskDesc] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);
  const { provider, model } = useAgentStore();

  const sources = currentSession?.sources ?? [];
  const formats = currentSession?.outputFormats ?? [];
  const canProcess = sources.length > 0 && formats.length > 0 && !isProcessing;
  const hasChat = (currentSession?.chatHistory.length ?? 0) > 0;
  const hasSession = !!currentSession?.claudeSessionId && currentSession?.sessionProvider === provider;

  // Summarize chat history into a task description
  const handleSummarize = async () => {
    if (!currentSession || !hasChat || isSummarizing) return;
    setIsSummarizing(true);
    setError(null);

    try {
      const res = await fetch("/api/documents/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sources: currentSession.sources,
          taskDescription: [
            "根據我們之前的對話，請歸納出一段簡潔的任務描述（2-3 句話），",
            "說明使用者想對這些檔案做什麼處理。",
            "只輸出任務描述本身，不要加引號或前言。",
          ].join(""),
          outputFormats: [],
          outputPath: "",
          claudeSessionId: currentSession.sessionProvider === provider ? currentSession.claudeSessionId : null,
          provider,
          model,
        }),
      });

      if (!res.ok) {
        setError("歸納失敗");
        setIsSummarizing(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) { setIsSummarizing(false); return; }

      let result = "";
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "text") result += event.content;
            else if (event.type === "session" && event.sessionId) {
              setClaudeSessionId(event.sessionId, provider);
            }
          } catch { /* skip */ }
        }
      }
      if (result) {
        setTaskDesc(cleanClaudeOutput(result));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "歸納失敗");
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleProcess = async () => {
    if (!currentSession || !canProcess) return;
    setProcessing(true);
    setError(null);
    setOutputContent("");

    try {
      const res = await fetch("/api/documents/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sources: currentSession.sources,
          taskDescription: taskDesc,
          outputFormats: currentSession.outputFormats,
          outputPath: currentSession.outputPath,
          // Use existing session if available — AI already has file context
          claudeSessionId: currentSession.sessionProvider === provider ? currentSession.claudeSessionId : null,
          provider,
          model,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Processing failed");
        setProcessing(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError("No response stream");
        setProcessing(false);
        return;
      }

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "text") {
              appendOutputContent(event.content);
            } else if (event.type === "session" && event.sessionId) {
              setClaudeSessionId(event.sessionId, provider);
            } else if (event.type === "saved" && event.path) {
              appendOutputContent(`\n\n---\n📁 已儲存至：${event.path}\n`);
            } else if (event.type === "error") {
              setError(event.content);
            }
          } catch {
            // skip
          }
        }
      }
      // Strip Claude output artifacts from accumulated output
      const current = useDocumentsStore.getState().currentSession?.outputContent ?? "";
      const cleaned = cleanClaudeOutput(current);
      if (cleaned !== current) setOutputContent(cleaned);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <SourceList />

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-cy-text">📝 任務描述</h3>
          {hasChat && (
            <button
              onClick={handleSummarize}
              disabled={isSummarizing || isProcessing}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-cy-accent hover:bg-cy-accent/10 transition-colors disabled:opacity-40"
            >
              {isSummarizing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              從對話歸納
            </button>
          )}
        </div>
        <textarea
          value={taskDesc}
          onChange={(e) => setTaskDesc(e.target.value)}
          placeholder={hasChat ? "先和 AI 聊，再按「從對話歸納」自動填入..." : "描述你想做什麼...（選填）"}
          rows={5}
          className="w-full resize-y rounded-md bg-cy-input/50 px-2.5 py-2 text-sm text-cy-text placeholder:text-cy-muted/60 outline-none focus:ring-1 focus:ring-cy-accent/40 min-h-[80px]"
        />
      </div>

      <OutputConfig />

      <button
        onClick={handleProcess}
        disabled={!canProcess}
        className={`mt-auto flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all ${
          canProcess
            ? "bg-cy-accent text-cy-bg hover:bg-cy-accent/90"
            : "bg-cy-input/50 text-cy-muted cursor-not-allowed"
        }`}
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            處理中...
          </>
        ) : (
          <>
            <Play className="h-4 w-4" />
            {hasSession ? "開始處理（延續對話）" : "開始處理"}
          </>
        )}
      </button>
    </div>
  );
}
