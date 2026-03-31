"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface OpenClawEntry {
  date: string;
  category: string;
  name: string;
  path: string;
}

const categoryLabels: Record<string, string> = {
  "daily-info": "每日資訊",
  "mail-info": "郵件摘要",
  "yt-summary": "YT 摘要",
  "weekly-info": "週報",
  "weekly-review": "週回顧",
};

const categoryColors: Record<string, string> = {
  "daily-info": "bg-cy-accent/20 text-cy-accent",
  "mail-info": "bg-cy-success/20 text-cy-success",
  "yt-summary": "bg-cy-error/20 text-cy-error",
  "weekly-info": "bg-purple-500/20 text-purple-400",
  "weekly-review": "bg-amber-500/20 text-amber-400",
};

function getCategoryColor(category: string): string {
  return categoryColors[category] ?? "bg-cy-muted/20 text-cy-muted";
}

function FeedItem({ entry }: { entry: OpenClawEntry }) {
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);

  const handleClick = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (content !== null) return; // already loaded

    setLoadingContent(true);
    try {
      const res = await fetch(
        `/api/openclaw/content?path=${encodeURIComponent(entry.path)}`
      );
      if (res.ok) {
        const json = await res.json();
        setContent(json.content ?? "");
      } else {
        setContent("（無法讀取檔案內容）");
      }
    } catch {
      setContent("（無法讀取檔案內容）");
    } finally {
      setLoadingContent(false);
    }
  };

  return (
    <div className="rounded transition-colors hover:bg-white/[0.03]">
      <button
        onClick={handleClick}
        className="flex w-full items-start gap-3 px-2 py-2 text-left"
      >
        <span className="mt-0.5 shrink-0 text-cy-muted">
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </span>
        <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cy-muted" />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span className="shrink-0 text-xs tabular-nums text-cy-muted">
            {entry.date}
          </span>
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${getCategoryColor(entry.category)}`}
          >
            {categoryLabels[entry.category] ?? entry.category}
          </span>
          <span className="truncate text-xs text-cy-text/80">
            {entry.name}
          </span>
        </div>
      </button>
      {expanded && (
        <div className="mx-2 mb-2 ml-9 rounded bg-cy-bg/50 p-3">
          {loadingContent ? (
            <div className="space-y-2">
              <div className="h-3 w-3/4 animate-pulse rounded bg-cy-input" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-cy-input" />
            </div>
          ) : entry.name.endsWith(".md") ? (
            <div className="prose prose-invert prose-xs max-h-[300px] max-w-none overflow-auto prose-headings:text-cy-text prose-headings:text-sm prose-p:text-xs prose-p:leading-relaxed prose-p:text-cy-text/80 prose-a:text-cy-accent prose-a:no-underline hover:prose-a:underline prose-strong:text-cy-text prose-li:text-xs prose-li:text-cy-text/80 prose-code:text-cy-accent/80 prose-code:text-xs prose-code:before:content-none prose-code:after:content-none prose-pre:bg-cy-bg/80 prose-pre:border prose-pre:border-cy-input/30 prose-hr:border-cy-input/30">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ href, children, ...props }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                      {children}
                    </a>
                  ),
                }}
              >
                {content ?? ""}
              </ReactMarkdown>
            </div>
          ) : (
            <pre className="max-h-[300px] overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-cy-text/80">
              {content}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

export function OpenClawFeed() {
  const [entries, setEntries] = useState<OpenClawEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/openclaw");
        if (res.ok) {
          const json = await res.json();
          setEntries(json.outputs ?? []);
        }
      } catch {
        // API unavailable
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="cy-glass rounded-lg p-4">
      <h2 className="mb-3 text-sm font-semibold text-cy-text">
        OpenClaw 產出
      </h2>

      <div className="max-h-[400px] overflow-y-auto">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-4 w-16 animate-pulse rounded bg-cy-input" />
                <div className="h-4 w-20 animate-pulse rounded bg-cy-input" />
                <div className="h-4 flex-1 animate-pulse rounded bg-cy-input" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-cy-muted">
            最近無產出
          </p>
        ) : (
          <div className="space-y-0.5">
            {entries.map((entry, i) => (
              <FeedItem key={`${entry.name}-${i}`} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
