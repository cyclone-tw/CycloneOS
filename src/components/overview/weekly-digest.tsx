"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { WeeklyReviewData } from "@/types/digest";

const COMPACT_COUNT = 3;

interface Props {
  data: WeeklyReviewData | null;
  loading: boolean;
}

export function WeeklyDigest({ data, loading }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [fullContent, setFullContent] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);

  const handleExpand = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (fullContent !== null || !data) return;

    setLoadingContent(true);
    try {
      const res = await fetch(
        `/api/openclaw/content?path=${encodeURIComponent(data.path)}`
      );
      if (res.ok) {
        const json = await res.json();
        setFullContent(json.content ?? "");
      }
    } catch {
      setFullContent("（無法讀取）");
    } finally {
      setLoadingContent(false);
    }
  };

  if (loading) return null;
  if (!data) return null;

  const visibleHighlights = expanded
    ? data.highlights
    : data.highlights.slice(0, COMPACT_COUNT);
  const hasMoreHighlights = data.highlights.length > COMPACT_COUNT;

  return (
    <div className="cy-glass rounded-lg px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-cy-muted">
          📊 週回顧
        </h2>
        <span className="text-xs text-cy-muted/80">{data.week}</span>
      </div>

      <div className="space-y-0.5">
        {visibleHighlights.map((h, i) => (
          <div key={i} className="flex items-start gap-1.5 text-xs text-cy-muted/70">
            <span className="mt-0.5 shrink-0">•</span>
            <span className="truncate">{h}</span>
          </div>
        ))}
      </div>

      <button
        onClick={hasMoreHighlights && !expanded ? () => setExpanded(true) : handleExpand}
        className="mt-1.5 flex w-full items-center justify-center gap-1 rounded py-0.5 text-xs text-cy-muted transition-colors hover:bg-cy-input/50 hover:text-cy-text"
      >
        {expanded ? (
          <>
            <ChevronUp className="h-3 w-3" />
            收合
          </>
        ) : (
          <>
            <ChevronDown className="h-3 w-3" />
            {hasMoreHighlights
              ? `查看更多（${data.highlights.length} 項）`
              : "展開完整內容"}
          </>
        )}
      </button>

      {expanded && (
        <div className="mt-1.5 rounded bg-cy-bg/50 p-2">
          {loadingContent ? (
            <div className="space-y-1.5">
              <div className="h-2.5 w-3/4 animate-pulse rounded bg-cy-input" />
              <div className="h-2.5 w-1/2 animate-pulse rounded bg-cy-input" />
            </div>
          ) : fullContent ? (
            <div className="prose prose-invert prose-xs max-h-[300px] max-w-none overflow-auto prose-headings:text-cy-text prose-headings:text-sm prose-p:text-xs prose-p:leading-relaxed prose-p:text-cy-text/85 prose-a:text-cy-accent prose-a:no-underline hover:prose-a:underline prose-strong:text-cy-text prose-li:text-xs prose-li:text-cy-text/85 prose-code:text-cy-accent/80 prose-code:text-xs prose-code:before:content-none prose-code:after:content-none prose-pre:bg-cy-bg/80 prose-pre:border prose-pre:border-cy-input/30 prose-hr:border-cy-input/30">
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
                {fullContent}
              </ReactMarkdown>
            </div>
          ) : (
            // Show remaining highlights if no full content yet
            data.highlights.slice(COMPACT_COUNT).map((h, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-cy-muted/70">
                <span className="mt-0.5 shrink-0">•</span>
                <span>{h}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
