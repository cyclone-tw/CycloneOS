"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import type { YtEntry } from "@/types/digest";

const COMPACT_COUNT = 3;

interface Props {
  entries: YtEntry[];
  loading: boolean;
}

export function YtDigest({ entries, loading }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <div className="cy-glass rounded-lg px-4 py-3">
        <div className="mb-2 h-3 w-20 animate-pulse rounded bg-cy-input" />
        <div className="space-y-1">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-4 animate-pulse rounded bg-cy-input/50" />
          ))}
        </div>
      </div>
    );
  }

  if (entries.length === 0) return null;

  const visible = expanded ? entries : entries.slice(0, COMPACT_COUNT);
  const hasMore = entries.length > COMPACT_COUNT;

  return (
    <div className="cy-glass rounded-lg px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-cy-muted">
          🎬 YT 摘要
        </h2>
        <span className="text-xs text-cy-muted/80">近 3 天</span>
      </div>

      <div className="space-y-0.5">
        {visible.map((entry, i) => (
          <a
            key={i}
            href={entry.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2 rounded px-1 py-0.5 text-xs transition-colors hover:bg-white/[0.04]"
          >
            <span className="shrink-0 text-sm">▶️</span>
            <span className="truncate text-cy-text/85 group-hover:text-cy-accent">
              {entry.title}
            </span>
            <span className="shrink-0 text-xs text-cy-muted/75">
              {entry.channel}
            </span>
            <ExternalLink className="h-2.5 w-2.5 shrink-0 text-cy-muted opacity-0 transition-opacity group-hover:opacity-100" />
          </a>
        ))}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
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
              查看更多（{entries.length} 部）
            </>
          )}
        </button>
      )}
    </div>
  );
}
