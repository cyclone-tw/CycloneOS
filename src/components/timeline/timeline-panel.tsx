"use client";

import { useEffect, useState } from "react";
import { GitCommit, Clock, Zap, Bot, Briefcase, Radio } from "lucide-react";
import type { TimelineEntry } from "@/app/api/timeline/route";

type FilterType = "all" | "dev" | "work" | "auto";

const FILTER_TABS: { key: FilterType; label: string }[] = [
  { key: "auto", label: "Auto" },
  { key: "work", label: "Work" },
  { key: "dev", label: "Dev" },
  { key: "all", label: "全部" },
];

const TYPE_CONFIG: Record<string, { color: string; dot: string; icon: typeof GitCommit }> = {
  dev: { color: "text-cy-accent", dot: "bg-cy-accent", icon: GitCommit },
  work: { color: "text-emerald-400", dot: "bg-emerald-400", icon: Briefcase },
  auto: { color: "text-amber-400", dot: "bg-amber-400", icon: Zap },
};

const SOURCE_ICON: Record<string, typeof GitCommit> = {
  git: GitCommit,
  session: Bot,
  cron: Radio,
};

interface TimelineData {
  grouped: Record<string, TimelineEntry[]>;
  stats: { total: number; dev: number; work: number; auto: number };
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return "今天";
  if (diff === 1) return "昨天";
  return d.toLocaleDateString("zh-TW", { month: "short", day: "numeric", weekday: "short" });
}

export function TimelinePanel() {
  const [data, setData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [days, setDays] = useState(30);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    setExpandedDates(new Set());
    fetch(`/api/timeline?days=${days}`)
      .then((res) => res.json())
      .then((d: TimelineData) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  const toggleDate = (date: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  // Filter entries
  const filteredGrouped: Record<string, TimelineEntry[]> = {};
  if (data) {
    for (const [date, entries] of Object.entries(data.grouped)) {
      const filtered = filter === "all" ? entries : entries.filter((e) => e.type === filter);
      if (filtered.length > 0) filteredGrouped[date] = filtered;
    }
  }

  const sortedDates = Object.keys(filteredGrouped).sort((a, b) => b.localeCompare(a));

  const filteredTotal = filter === "all"
    ? data?.stats.total ?? 0
    : (data?.stats[filter] ?? 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-cy-text flex items-center gap-2">
          <Clock className="h-5 w-5 text-cy-accent" />
          Evolution Timeline
        </h1>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-md bg-cy-input/40 px-2 py-1 text-xs text-cy-muted outline-none"
          >
            <option value={7}>7 天</option>
            <option value={14}>14 天</option>
            <option value={30}>30 天</option>
            <option value={60}>60 天</option>
          </select>
          <span className="text-xs text-cy-muted">
            {filteredTotal} entries
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1">
        {FILTER_TABS.map((tab) => {
          const count =
            tab.key === "all"
              ? data?.stats.total ?? 0
              : (data?.stats[tab.key] ?? 0);
          const isActive = filter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-cy-accent/20 text-cy-accent"
                  : "text-cy-muted hover:bg-cy-input/40 hover:text-cy-text"
              }`}
            >
              {tab.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12 text-cy-muted">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-cy-accent border-t-transparent" />
          <span className="ml-2 text-sm">載入時間線...</span>
        </div>
      )}

      {/* Timeline */}
      {!loading && sortedDates.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-cy-muted">
          <Clock className="mb-3 h-8 w-8 opacity-30" />
          <p className="text-sm">沒有符合條件的紀錄</p>
        </div>
      )}

      {!loading && sortedDates.length > 0 && (
        <div className="relative ml-3 border-l border-cy-border pl-6">
          {sortedDates.map((date) => {
            const entries = filteredGrouped[date];
            const isExpanded = expandedDates.has(date);
            const SHOW_LIMIT = 5;
            const needsCollapse = entries.length > SHOW_LIMIT;
            const visible = needsCollapse && !isExpanded ? entries.slice(0, SHOW_LIMIT) : entries;
            const hiddenCount = entries.length - SHOW_LIMIT;

            return (
              <div key={date} className="mb-6">
                {/* Date marker */}
                <div className="relative mb-3 flex items-center gap-2">
                  <div className="absolute -left-[31px] h-3 w-3 rounded-full border-2 border-cy-accent bg-cy-bg" />
                  <span className="text-sm font-semibold text-cy-accent">
                    {formatDate(date)}
                  </span>
                  <span className="text-xs text-cy-muted">{date}</span>
                </div>

                {/* Entries */}
                <div className="space-y-1.5">
                  {visible.map((entry) => {
                    const cfg = TYPE_CONFIG[entry.type] ?? TYPE_CONFIG.dev;
                    const SourceIcon = SOURCE_ICON[entry.source] ?? GitCommit;
                    return (
                      <div
                        key={entry.id}
                        className="group relative flex items-start gap-3 rounded-lg border border-transparent px-3 py-2 transition-colors hover:border-cy-input/30 hover:bg-cy-card/60"
                      >
                        {/* Dot on timeline */}
                        <div className={`absolute -left-[27px] mt-2 h-1.5 w-1.5 rounded-full ${cfg.dot}`} />

                        {/* Icon */}
                        <SourceIcon className={`mt-0.5 h-4 w-4 shrink-0 ${cfg.color}`} strokeWidth={1.8} />

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-cy-text/90 leading-snug">
                              {entry.title}
                            </span>
                          </div>
                          {entry.description && entry.description !== entry.title && (
                            <p className="mt-0.5 truncate text-xs text-cy-muted/70">
                              {entry.description}
                            </p>
                          )}
                        </div>

                        {/* Badge */}
                        {entry.badge && (
                          <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs font-mono ${cfg.color} bg-current/10`}
                            style={{ backgroundColor: `color-mix(in srgb, currentColor 10%, transparent)` }}
                          >
                            {entry.badge}
                          </span>
                        )}
                      </div>
                    );
                  })}

                  {/* Collapse toggle */}
                  {needsCollapse && (
                    <button
                      onClick={() => toggleDate(date)}
                      className="ml-3 mt-1 text-xs text-cy-accent/70 hover:text-cy-accent transition-colors"
                    >
                      {isExpanded
                        ? `▲ 收合`
                        : `▼ 展開 ${hiddenCount} 筆更多`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
