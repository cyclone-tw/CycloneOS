"use client";

import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";

interface JobProgressProps {
  status: "processing" | "completed" | "failed";
  step: string;
  title?: string;
  error?: string;
}

const STEPS = [
  { key: "downloading", label: "下載影片" },
  { key: "transcribing", label: "取得逐字稿" },
  { key: "summarizing", label: "AI 摘要" },
  { key: "saving", label: "儲存" },
];

export function JobProgress({ status, step, title, error }: JobProgressProps) {
  const currentIdx = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="rounded-lg border border-cy-border bg-cy-card p-4 space-y-3">
      {title && (
        <p className="text-sm font-medium text-cy-text truncate">{title}</p>
      )}

      <div className="flex items-center gap-3">
        {STEPS.map((s, i) => {
          let icon;
          if (status === "failed" && i === currentIdx) {
            icon = <XCircle className="h-4 w-4 text-red-400" />;
          } else if (i < currentIdx || status === "completed") {
            icon = <CheckCircle2 className="h-4 w-4 text-green-400" />;
          } else if (i === currentIdx && status === "processing") {
            icon = <Loader2 className="h-4 w-4 animate-spin text-cy-accent" />;
          } else {
            icon = <Circle className="h-4 w-4 text-cy-muted/40" />;
          }

          return (
            <div key={s.key} className="flex items-center gap-1.5">
              {icon}
              <span
                className={`text-xs ${
                  i <= currentIdx ? "text-cy-text" : "text-cy-muted/60"
                }`}
              >
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <div className="mx-1 h-px w-4 bg-cy-border" />
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
