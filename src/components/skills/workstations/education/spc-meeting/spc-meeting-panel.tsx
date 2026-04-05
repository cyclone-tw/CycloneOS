"use client";

import { ArrowLeft } from "lucide-react";

interface SpcMeetingPanelProps {
  onBack: () => void;
}

export function SpcMeetingPanel({ onBack }: SpcMeetingPanelProps) {
  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 5.5rem)" }}>
      <div className="flex items-center gap-3 border-b border-cy-border pb-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-cy-muted hover:bg-cy-input/50 hover:text-cy-text transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          教育工作站
        </button>
        <span className="text-lg">📋</span>
        <h1 className="text-lg font-bold text-cy-text">特推會會議記錄</h1>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-cy-muted">特推會面板建構中...</p>
      </div>
    </div>
  );
}
