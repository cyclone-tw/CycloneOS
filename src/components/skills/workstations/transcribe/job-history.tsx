"use client";

import { ExternalLink, FileText, CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface HistoryJob {
  id: string;
  status: "processing" | "completed" | "failed";
  step: string;
  meta?: { title: string; channel: string; duration: string; url: string };
  result?: { obsidianPath: string; notionUrl: string; title: string };
  error?: string;
  createdAt: number;
}

interface JobHistoryProps {
  jobs: HistoryJob[];
}

export function JobHistory({ jobs }: JobHistoryProps) {
  if (jobs.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-cy-muted">
        尚無處理紀錄
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-cy-muted">最近處理</h3>
      {jobs.map((job) => (
        <div
          key={job.id}
          className="flex items-center gap-3 rounded-lg border border-cy-border bg-cy-card p-3"
        >
          {job.status === "completed" && <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />}
          {job.status === "failed" && <XCircle className="h-4 w-4 shrink-0 text-red-400" />}
          {job.status === "processing" && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-cy-accent" />}

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-cy-text">
              {job.meta?.title || job.result?.title || job.id}
            </p>
            <p className="text-xs text-cy-muted">
              {job.meta?.channel && `${job.meta.channel} · `}
              {job.meta?.duration || ""}
              {job.error && <span className="text-red-400"> {job.error}</span>}
            </p>
          </div>

          {job.status === "completed" && job.meta?.url && (
            <a
              href={job.meta.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cy-muted hover:text-cy-text transition-colors"
              title="開啟 YouTube"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
          {job.result?.notionUrl && (
            <a
              href={job.result.notionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cy-muted hover:text-cy-text transition-colors"
              title="開啟 Notion"
            >
              <FileText className="h-4 w-4" />
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
