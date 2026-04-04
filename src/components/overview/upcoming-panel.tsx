"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
} from "lucide-react";

interface TaskItem {
  id: string;
  name: string;
  type: "任務" | "活動";
  status: string;
  priority: string | null;
  date: string | null;
  dateEnd: string | null;
  summary: string;
  url: string;
}

function PriorityBadge({ priority }: { priority: string | null }) {
  if (!priority) return null;
  const colors: Record<string, string> = {
    高: "bg-red-500/20 text-red-400",
    中: "bg-yellow-500/20 text-yellow-400",
    低: "bg-green-500/20 text-green-400",
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${colors[priority] || "bg-cy-input/50 text-cy-muted"}`}>
      {priority}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    待處理: "bg-cy-muted/60",
    進行中: "bg-cy-accent",
  };
  return <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${colors[status] || "bg-cy-muted/40"}`} />;
}

function formatDate(dateStr: string | null, endStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateOnly = new Date(dateStr.slice(0, 10) + "T00:00:00");

  let label = "";
  if (dateOnly.getTime() === today.getTime()) label = "今天";
  else if (dateOnly.getTime() === tomorrow.getTime()) label = "明天";
  else label = `${d.getMonth() + 1}/${d.getDate()}`;

  // Add time if available
  if (dateStr.includes("T")) {
    const time = d.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false });
    label += ` ${time}`;
  }

  if (endStr?.includes("T")) {
    const end = new Date(endStr);
    const endTime = end.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false });
    label += `–${endTime}`;
  }

  return label;
}

function ItemCard({ item }: { item: TaskItem }) {
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadContent = useCallback(async () => {
    if (content !== null) {
      setExpanded(!expanded);
      return;
    }
    setExpanded(true);
    setLoading(true);
    try {
      const res = await fetch(`/api/notion/page?id=${item.id}`);
      const data = await res.json();
      setContent(data.content || "（無內容）");
    } catch {
      setContent("（載入失敗）");
    } finally {
      setLoading(false);
    }
  }, [item.id, content, expanded]);

  return (
    <div className="rounded-lg border border-cy-border/50 bg-cy-bg/40 px-3 py-2.5">
      <div className="flex items-start gap-2">
        <button onClick={loadContent} className="mt-0.5 shrink-0 text-cy-muted hover:text-cy-text transition-colors">
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <StatusDot status={item.status} />
            <span className="truncate text-sm text-cy-text">{item.name}</span>
            <PriorityBadge priority={item.priority} />
          </div>

          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-cy-muted">
            {item.date && <span>{formatDate(item.date, item.dateEnd)}</span>}
            {item.summary && (
              <>
                {item.date && <span>·</span>}
                <span className="truncate">{item.summary}</span>
              </>
            )}
          </div>
        </div>

        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-0.5 shrink-0 text-cy-muted/50 hover:text-cy-text transition-colors"
          title="在 Notion 開啟"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {expanded && (
        <div className="mt-2 ml-5.5 border-l-2 border-cy-border/30 pl-3 text-xs text-cy-muted whitespace-pre-wrap">
          {loading ? (
            <div className="flex items-center gap-1.5 py-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              載入中...
            </div>
          ) : (
            content
          )}
        </div>
      )}
    </div>
  );
}

export function UpcomingPanel() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [events, setEvents] = useState<TaskItem[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/notion/tasks")
      .then((r) => r.json())
      .then((data) => {
        setTasks(data.tasks || []);
        setEvents(data.events || []);
        setConfigured(data.configured !== false);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="cy-glass rounded-lg p-4">
      <h2 className="mb-3 text-sm font-semibold text-cy-text">
        待辦 & 行程
      </h2>

      {/* Tasks */}
      <div className="mb-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-cy-muted uppercase tracking-wider">
          <CheckSquare className="h-3 w-3" />
          待辦事項
          {tasks.length > 0 && (
            <span className="rounded-full bg-cy-input/50 px-1.5 text-[10px]">{tasks.length}</span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-cy-muted" />
          </div>
        ) : !configured ? (
          <p className="py-3 text-center text-xs text-cy-muted">Notion 尚未設定</p>
        ) : tasks.length === 0 ? (
          <p className="py-3 text-center text-xs text-cy-muted">沒有待辦事項</p>
        ) : (
          <div className="space-y-1.5">
            {tasks.map((t) => <ItemCard key={t.id} item={t} />)}
          </div>
        )}
      </div>

      {/* Events (7 days) */}
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-cy-muted uppercase tracking-wider">
          <CalendarDays className="h-3 w-3" />
          近 7 日行程
          {events.length > 0 && (
            <span className="rounded-full bg-cy-input/50 px-1.5 text-[10px]">{events.length}</span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-cy-muted" />
          </div>
        ) : !configured ? (
          <p className="py-3 text-center text-xs text-cy-muted">Notion 尚未設定</p>
        ) : events.length === 0 ? (
          <p className="py-3 text-center text-xs text-cy-muted">近 7 日無行程</p>
        ) : (
          <div className="space-y-1.5">
            {events.map((e) => <ItemCard key={e.id} item={e} />)}
          </div>
        )}
      </div>
    </div>
  );
}
