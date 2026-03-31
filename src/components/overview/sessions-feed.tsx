"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, ChevronUp } from "lucide-react";

interface SessionEntry {
  name: string;
  date: string;
  session: number;
  source: string;
  sessionType?: string;
  summary?: string;
  path: string;
}

const sourceColors: Record<string, string> = {
  cycloneos: "bg-cy-accent/20 text-cy-accent",
  general: "bg-purple-500/20 text-purple-400",
};

const sourceLabels: Record<string, string> = {
  cycloneos: "CycloneOS",
  general: "General",
};

const typeColors: Record<string, string> = {
  dev: "bg-cy-warning/20 text-cy-warning",
  work: "bg-cy-success/20 text-cy-success",
};

const typeLabels: Record<string, string> = {
  dev: "Dev",
  work: "Work",
};

function SessionRow({ entry }: { entry: SessionEntry }) {
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);

  const handleClick = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (content !== null) return;

    setLoadingContent(true);
    try {
      const res = await fetch(
        `/api/sessions/content?path=${encodeURIComponent(entry.path)}`
      );
      if (res.ok) {
        const json = await res.json();
        let text: string = json.content ?? "";
        const fmMatch = text.match(/^---\n[\s\S]*?\n---\n/);
        if (fmMatch) text = text.slice(fmMatch[0].length).trim();
        setContent(text);
      } else {
        setContent("（無法讀取）");
      }
    } catch {
      setContent("（無法讀取）");
    } finally {
      setLoadingContent(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleClick}
        className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-xs transition-colors hover:bg-white/[0.04]"
      >
        <span className="shrink-0 text-cy-muted/75">
          {expanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </span>
        <span className="shrink-0 tabular-nums text-cy-muted/70">
          {entry.date}
        </span>
        <span
          className={`shrink-0 rounded px-1 py-px text-xs font-medium ${
            sourceColors[entry.source] ?? "bg-cy-muted/20 text-cy-muted"
          }`}
        >
          {sourceLabels[entry.source] ?? entry.source}
        </span>
        {entry.sessionType && (
          <span
            className={`shrink-0 rounded px-1 py-px text-xs font-medium ${
              typeColors[entry.sessionType] ?? "bg-cy-muted/20 text-cy-muted"
            }`}
          >
            {typeLabels[entry.sessionType] ?? entry.sessionType}
          </span>
        )}
        <span className="shrink-0 text-cy-muted/80">
          #{entry.session}
        </span>
        {entry.summary && (
          <span className="truncate text-left text-cy-text/60">
            {entry.summary}
          </span>
        )}
      </button>
      {expanded && (
        <div className="mb-1 ml-5 mt-0.5 rounded bg-cy-bg/50 p-2">
          {loadingContent ? (
            <div className="space-y-1.5">
              <div className="h-2.5 w-3/4 animate-pulse rounded bg-cy-input" />
              <div className="h-2.5 w-1/2 animate-pulse rounded bg-cy-input" />
            </div>
          ) : (
            <pre className="max-h-[250px] overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-cy-text/85">
              {content}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

const COMPACT_COUNT = 5;

export function SessionsFeed() {
  const [entries, setEntries] = useState<SessionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch("/api/sessions?days=7")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json) setEntries(json.sessions ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const visible = expanded ? entries : entries.slice(0, COMPACT_COUNT);
  const hasMore = entries.length > COMPACT_COUNT;

  return (
    <div className="cy-glass rounded-lg px-4 py-3">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-cy-muted">
        Session Logs
      </h2>

      {loading ? (
        <div className="flex gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-3 w-32 animate-pulse rounded bg-cy-input" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="text-xs text-cy-muted">最近無 Session 記錄</p>
      ) : (
        <>
          <div className={expanded ? "max-h-[350px] overflow-y-auto" : ""}>
            <div className="space-y-0.5">
              {visible.map((entry, i) => (
                <SessionRow key={`${entry.name}-${i}`} entry={entry} />
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
                  查看更多（{entries.length} 筆）
                </>
              )}
            </button>
          )}
        </>
      )}
    </div>
  );
}
