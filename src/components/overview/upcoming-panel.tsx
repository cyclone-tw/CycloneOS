"use client";

import { CalendarDays, CheckSquare } from "lucide-react";

export function UpcomingPanel() {
  return (
    <div className="cy-glass rounded-lg p-4">
      <h2 className="mb-3 text-sm font-semibold text-cy-text">
        待辦 & 行程
      </h2>

      {/* Tasks placeholder */}
      <div className="mb-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-cy-muted uppercase tracking-wider">
          <CheckSquare className="h-3 w-3" />
          待辦事項
        </div>
        <div className="rounded bg-cy-bg/50 px-3 py-4 text-center">
          <p className="text-xs text-cy-muted">
            Notion CY Task v2 — Milestone 3 接入
          </p>
        </div>
      </div>

      {/* Calendar placeholder */}
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-cy-muted uppercase tracking-wider">
          <CalendarDays className="h-3 w-3" />
          今日行程
        </div>
        <div className="rounded bg-cy-bg/50 px-3 py-4 text-center">
          <p className="text-xs text-cy-muted">
            Google Calendar — Milestone 3 接入
          </p>
        </div>
      </div>
    </div>
  );
}
