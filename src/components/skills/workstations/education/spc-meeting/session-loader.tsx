// src/components/skills/workstations/education/spc-meeting/session-loader.tsx
"use client";

import { useEffect, useState } from "react";
import { FileText, FolderOpen, Plus } from "lucide-react";

interface DraftSession {
  filename: string;
  status: string;
  meetingNumber: number;
  date: string;
  topics: string[];
}

interface SessionLoaderProps {
  academicYear: number;
  onLoad: (filename: string) => void;
  onNew: () => void;
}

export function SessionLoader({ academicYear, onLoad, onNew }: SessionLoaderProps) {
  const [drafts, setDrafts] = useState<DraftSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/education/spc-meeting/load?year=${academicYear}`);
        const data = await res.json();
        setDrafts(data.drafts ?? []);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [academicYear]);

  if (loading) return null;
  if (drafts.length === 0) return null;

  const statusLabel = (status: string) => {
    switch (status) {
      case "draft": return "草稿";
      case "agenda-generated": return "已備會";
      default: return status;
    }
  };

  return (
    <div className="rounded-lg border border-cy-accent/30 bg-cy-accent/5 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-cy-text">
        <FolderOpen className="h-4 w-4 text-cy-accent" />
        偵測到未完成的會議
      </div>

      <div className="space-y-1.5">
        {(showAll ? drafts : drafts.slice(0, 3)).map((d) => (
          <button
            key={d.filename}
            onClick={() => onLoad(d.filename)}
            className="flex w-full items-center gap-2 rounded-md bg-cy-input/50 px-3 py-2 text-left text-sm hover:bg-cy-input transition-colors"
          >
            <FileText className="h-3.5 w-3.5 shrink-0 text-cy-muted" />
            <span className="flex-1 text-cy-text">
              第 {d.meetingNumber} 次 — {d.topics.join("、") || "未分類"}
            </span>
            <span className="shrink-0 text-xs text-cy-muted">{statusLabel(d.status)}</span>
            {d.date && <span className="shrink-0 text-xs text-cy-muted">{d.date}</span>}
          </button>
        ))}
        {!showAll && drafts.length > 3 && (
          <button
            onClick={() => setShowAll(true)}
            className="text-xs text-cy-accent hover:text-cy-accent/80"
          >
            顯示更多 ({drafts.length - 3})
          </button>
        )}
      </div>

      <button
        onClick={onNew}
        className="flex items-center gap-1.5 text-xs text-cy-muted hover:text-cy-text"
      >
        <Plus className="h-3 w-3" />
        開新會議
      </button>
    </div>
  );
}
