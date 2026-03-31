"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, RefreshCw } from "lucide-react";

interface AuditEntry {
  time: string;
  tool: string;
  detail: string;
}

const toolColors: Record<string, string> = {
  Bash: "bg-cy-success/20 text-cy-success",
  Edit: "bg-cy-accent/20 text-cy-accent",
  Read: "bg-slate-500/20 text-slate-400",
  Write: "bg-purple-500/20 text-purple-400",
  Grep: "bg-cy-warning/20 text-cy-warning",
  Glob: "bg-cyan-500/20 text-cyan-400",
  Notion: "bg-indigo-500/20 text-indigo-400",
  WebFetch: "bg-orange-500/20 text-orange-400",
};

function getToolColor(tool: string): string {
  return toolColors[tool] ?? "bg-cy-muted/20 text-cy-muted";
}

function formatTime(time: string): string {
  const date = new Date(time);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function summarizeDetail(tool: string, detail: string, maxLen: number): string {
  if (!detail) return "";
  if (tool === "Edit" || tool === "Write" || tool === "Read") {
    const parts = detail.split("/");
    return parts.length > 1 ? "…/" + parts.slice(-2).join("/") : detail;
  }
  const d = detail.trim();
  return d.length > maxLen ? d.slice(0, maxLen - 3) + "…" : d;
}

function isSignificantEntry(entry: AuditEntry): boolean {
  if (entry.tool !== "Bash") return true;
  const d = entry.detail.trim();
  if (/^(ls|cat|head|tail|echo|wc|pwd|which|type)\s/.test(d)) return false;
  return true;
}

const COMPACT_COUNT = 5;
const EXPANDED_COUNT = 30;

export function ActivityTimeline() {
  const [allEntries, setAllEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/audit?limit=100");
      if (res.ok) {
        const json = await res.json();
        const all: AuditEntry[] = json.entries ?? [];
        setAllEntries(all.filter(isSignificantEntry).slice(0, EXPANDED_COUNT));
      }
    } catch {
      // API unavailable
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const visible = expanded ? allEntries : allEntries.slice(0, COMPACT_COUNT);
  const hasMore = allEntries.length > COMPACT_COUNT;

  return (
    <div className="cy-glass rounded-lg px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-cy-muted uppercase tracking-wider">
          近期操作
        </h2>
        <button
          onClick={fetchData}
          className="rounded p-0.5 text-cy-muted transition-colors hover:bg-cy-input hover:text-cy-text"
          aria-label="Refresh"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>

      {loading ? (
        <div className="flex gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-3 w-32 animate-pulse rounded bg-cy-input" />
          ))}
        </div>
      ) : allEntries.length === 0 ? (
        <p className="text-xs text-cy-muted">尚無操作記錄</p>
      ) : (
        <>
          <div className={expanded ? "max-h-[350px] overflow-y-auto" : ""}>
            <div className="space-y-1">
              {visible.map((entry, i) => (
                <div
                  key={`${entry.time}-${i}`}
                  className="flex items-center gap-2 text-xs"
                  title={entry.detail}
                >
                  <span className="shrink-0 tabular-nums text-cy-muted/70">
                    {formatTime(entry.time)}
                  </span>
                  <span
                    className={`shrink-0 rounded px-1 py-px text-xs font-medium ${getToolColor(entry.tool)}`}
                  >
                    {entry.tool}
                  </span>
                  <span className="truncate text-cy-text/60">
                    {summarizeDetail(entry.tool, entry.detail, expanded ? 80 : 60)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {hasMore && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-2 flex w-full items-center justify-center gap-1 rounded py-1 text-xs text-cy-muted transition-colors hover:bg-cy-input/50 hover:text-cy-text"
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  收合
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  查看更多（{allEntries.length} 筆）
                </>
              )}
            </button>
          )}
        </>
      )}
    </div>
  );
}
