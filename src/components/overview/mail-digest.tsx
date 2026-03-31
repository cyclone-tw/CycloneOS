"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { MailReportData } from "@/types/digest";

const categoryIcons: Record<string, string> = {
  "需要處理 / 回覆 / 繳費": "🔴",
  "重要通知": "🟡",
  "學習電子報": "📖",
  "課程平台": "🎓",
  "促銷 / 服務": "🏷️",
  "系統報告": "⚙️",
};

interface Props {
  data: MailReportData | null;
  loading: boolean;
}

export function MailDigest({ data, loading }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <div className="cy-glass rounded-lg px-4 py-3">
        <div className="mb-2 h-3 w-20 animate-pulse rounded bg-cy-input" />
        <div className="h-4 animate-pulse rounded bg-cy-input/50" />
      </div>
    );
  }

  if (!data) return null;

  const priorityCategories = data.categories.filter(
    (c) => c.label.includes("處理") || c.label.includes("重要")
  );
  const otherCategories = data.categories.filter(
    (c) => !c.label.includes("處理") && !c.label.includes("重要")
  );
  const otherCount = otherCategories.reduce((s, c) => s + c.count, 0);

  return (
    <div className="cy-glass rounded-lg px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-cy-muted">
          📧 郵件摘要
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-cy-muted/80">
            {data.unreadCount} 封未讀
          </span>
          {data.actionRequired > 0 && (
            <span className="rounded bg-cy-error/20 px-1 py-px text-xs font-medium text-cy-error">
              {data.actionRequired} 需處理
            </span>
          )}
          <span className="text-xs text-cy-muted/80">{data.time}</span>
        </div>
      </div>

      {/* Priority categories always shown */}
      <div className="space-y-1">
        {priorityCategories.map((cat) => (
          <div key={cat.label}>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-xs">{categoryIcons[cat.label] ?? "📧"}</span>
              <span className="font-medium text-cy-text/85">{cat.label}</span>
              <span className="text-cy-muted/75">({cat.count})</span>
            </div>
            <div className="ml-5 space-y-0">
              {cat.items.map((item, i) => (
                <div key={i} className="truncate text-xs text-cy-muted/70">
                  {item}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Other categories collapsed */}
      {otherCategories.length > 0 && (
        <>
          {expanded && (
            <div className="mt-1 space-y-1">
              {otherCategories.map((cat) => (
                <div key={cat.label}>
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-xs">{categoryIcons[cat.label] ?? "📧"}</span>
                    <span className="font-medium text-cy-text/85">{cat.label}</span>
                    <span className="text-cy-muted/75">({cat.count})</span>
                  </div>
                  <div className="ml-5 space-y-0">
                    {cat.items.map((item, i) => (
                      <div key={i} className="truncate text-xs text-cy-muted/70">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
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
                其他 {otherCount} 封
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
}
