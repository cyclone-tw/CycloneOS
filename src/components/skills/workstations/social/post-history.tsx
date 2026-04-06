// src/components/skills/workstations/social/post-history.tsx
"use client";

import { useEffect, useState } from "react";
import { RefreshCw, ExternalLink } from "lucide-react";
import { useSocialStore } from "@/stores/social-store";
import type { HistoryPost } from "@/stores/social-store";

const STATUS_COLORS: Record<string, string> = {
  草稿: "text-cy-muted",
  待發布: "text-yellow-500",
  已發布: "text-green-500",
  partial: "text-yellow-500",
  published: "text-green-500",
  draft: "text-cy-muted",
};

const PLATFORM_LABEL: Record<string, string> = {
  fb: "FB",
  ig: "IG",
  line: "LINE",
  school: "學校",
  notion: "Notion",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export function PostHistory() {
  const { history, setHistory } = useSocialStore();
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchHistory = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/social/history");
      const data = (await res.json()) as { posts?: HistoryPost[]; error?: string };
      if (data.posts) {
        setHistory(data.posts);
      } else {
        setLoadError(data.error ?? "載入失敗");
      }
    } catch {
      setLoadError("載入歷史記錄失敗");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-cy-muted uppercase tracking-wide">
          歷史記錄
        </span>
        <button
          onClick={fetchHistory}
          disabled={isLoading}
          className="rounded p-1 text-cy-muted hover:text-cy-text hover:bg-cy-input transition-colors disabled:opacity-50"
          title="重新整理"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Error */}
      {loadError && (
        <p className="text-xs text-cy-error">{loadError}</p>
      )}

      {/* Empty state */}
      {!isLoading && !loadError && history.length === 0 && (
        <p className="py-3 text-center text-xs text-cy-muted">尚無發文記錄</p>
      )}

      {/* List */}
      {history.length > 0 && (
        <ul className="max-h-48 overflow-y-auto flex flex-col divide-y divide-cy-border rounded-lg border border-cy-border">
          {history.map((post) => (
            <li key={post.id}>
              <a
                href={post.notionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start justify-between gap-2 px-3 py-2.5 hover:bg-cy-card transition-colors group"
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-xs font-medium text-cy-text truncate">{post.title}</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[10px] font-semibold ${STATUS_COLORS[post.status] ?? "text-cy-muted"}`}>
                      {post.status === "draft"
                        ? "草稿"
                        : post.status === "partial"
                        ? "待發布"
                        : post.status === "published"
                        ? "已發布"
                        : post.status}
                    </span>
                    {post.date && (
                      <span className="text-[10px] text-cy-muted">{formatDate(post.date)}</span>
                    )}
                    {post.platforms.length > 0 && (
                      <span className="text-[10px] text-cy-muted">
                        {post.platforms.map((p) => PLATFORM_LABEL[p] ?? p).join("・")}
                      </span>
                    )}
                  </div>
                </div>
                <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 text-cy-muted group-hover:text-cy-accent transition-colors mt-0.5" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
