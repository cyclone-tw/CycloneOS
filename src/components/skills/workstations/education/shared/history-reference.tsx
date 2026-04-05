"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, FileText } from "lucide-react";

export interface HistoryRecord {
  filename: string;
  date: string;
  topic: string;
  excerpt: string;
}

interface HistoryReferenceProps {
  records: HistoryRecord[];
  loading?: boolean;
  label?: string;
}

export function HistoryReference({ records, loading, label }: HistoryReferenceProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  if (records.length === 0 && !loading) return null;

  const displayRecords = showAll ? records : records.slice(0, 3);
  const hiddenCount = records.length - 3;

  return (
    <div className="rounded-lg border border-cy-border">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-cy-muted hover:text-cy-text transition-colors"
      >
        {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        {label ?? `查看歷史參考（找到 ${records.length} 份同類）`}
        {loading && <span className="text-[10px]">載入中...</span>}
      </button>

      {isOpen && (
        <div className="border-t border-cy-border px-3 py-2 space-y-3">
          {displayRecords.map((record) => (
            <div key={record.filename} className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-cy-text">
                <FileText className="h-3 w-3 text-cy-muted" />
                {record.filename}
                <span className="text-cy-muted">（{record.date}）</span>
              </div>
              <p className="pl-4.5 text-xs text-cy-muted line-clamp-2">{record.excerpt}</p>
            </div>
          ))}
          {!showAll && hiddenCount > 0 && (
            <button
              onClick={() => setShowAll(true)}
              className="text-xs text-cy-accent hover:text-cy-accent/80"
            >
              顯示更多 ({hiddenCount})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
