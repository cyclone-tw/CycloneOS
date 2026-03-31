"use client";

import { useState } from "react";
import { useGmailStore, type ClassifyResult } from "@/stores/gmail-store";
import { Sparkles, Tag, AlertCircle, Clock, Loader2 } from "lucide-react";

const URGENCY_STYLES = {
  high: "bg-red-500/20 text-red-400",
  medium: "bg-yellow-500/20 text-yellow-400",
  low: "bg-green-500/20 text-green-400",
} as const;

const URGENCY_LABELS = {
  high: "急件",
  medium: "一般",
  low: "不急",
} as const;

export function LabelManager() {
  const { selectedThread, getCachedClassify, setCachedClassify } = useGmailStore();
  const [result, setResult] = useState<ClassifyResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClassify() {
    if (!selectedThread) return;

    // Check cache first
    const cached = getCachedClassify(selectedThread.id, false);
    if (cached) {
      setResult(cached);
      setIsCached(true);
      return;
    }
    setIsCached(false);

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/gmail/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: selectedThread.id }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
      setCachedClassify(selectedThread.id, data, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "分類失敗");
    } finally {
      setIsLoading(false);
    }
  }

  if (!selectedThread) return null;

  return (
    <div className="space-y-2">
      <button
        onClick={handleClassify}
        disabled={isLoading}
        className="flex w-full items-center justify-center gap-1.5 rounded-md bg-cy-accent/15 px-3 py-1.5 text-xs font-medium text-cy-accent transition-colors hover:bg-cy-accent/25 disabled:opacity-50"
      >
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        AI 分類
      </button>

      {error && (
        <div className="flex items-center gap-1.5 rounded-md bg-red-500/10 px-2.5 py-1.5 text-xs text-red-400">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-2 rounded-md border border-cy-input/30 bg-cy-bg/50 p-2.5">
          {/* Summary */}
          <p className="text-xs text-cy-text/80">{result.summary}</p>

          {/* Labels */}
          <div className="flex flex-wrap gap-1">
            {result.labels.map((l) => (
              <span
                key={l.id}
                className="inline-flex items-center gap-1 rounded-full bg-cy-accent/10 px-2 py-0.5 text-xs text-cy-accent"
              >
                <Tag className="h-2.5 w-2.5" />
                {l.id}
                <span className="opacity-60">{Math.round(l.confidence * 100)}%</span>
              </span>
            ))}
          </div>

          {/* Urgency + needs reply */}
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${URGENCY_STYLES[result.urgency]}`}
            >
              <Clock className="h-2.5 w-2.5" />
              {URGENCY_LABELS[result.urgency]}
            </span>
            {result.needsReply && (
              <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-400">
                需要回覆
              </span>
            )}
          </div>

          <p className="text-xs text-cy-muted">
            {isCached ? "⚡ 快取結果" : "⚠️ Gmail MCP 無法自動套用 label，請至 Gmail 手動操作"}
          </p>
        </div>
      )}
    </div>
  );
}
