"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface PreviousDecisionsProps {
  academicYear: number;
  meetingNumber: number;
  value: string;
  onChange: (value: string) => void;
}

export function PreviousDecisions({ academicYear, meetingNumber, value, onChange }: PreviousDecisionsProps) {
  const requestKey =
    academicYear > 0 && meetingNumber > 1
      ? `${academicYear}-${meetingNumber}`
      : null;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const loading = requestKey !== null && settledKey !== requestKey;
  const loaded = requestKey !== null && loadedKey === requestKey;

  useEffect(() => {
    if (!requestKey || settledKey === requestKey) return;

    fetch(`/api/education/spc-meeting/history?year=${academicYear}&meetingNumber=${meetingNumber}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.previousDecisions && !value) {
          onChange(data.previousDecisions);
        }
        setLoadedKey(requestKey);
      })
      .catch(() => {})
      .finally(() => setSettledKey(requestKey));
  }, [academicYear, meetingNumber, onChange, requestKey, settledKey, value]);

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <label className="text-xs font-medium text-cy-muted">前次會議決議追蹤</label>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-cy-muted" />}
        {loaded && meetingNumber > 1 && (
          <span className="text-[10px] text-cy-muted">
            （自動從第 {meetingNumber - 1} 次帶入）
          </span>
        )}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={meetingNumber <= 1 ? "第一次會議，無前次決議" : "載入中..."}
        rows={4}
        className="w-full rounded-md border border-cy-border bg-cy-input px-3 py-2 text-sm text-cy-text focus:border-cy-accent focus:outline-none resize-y"
      />
    </div>
  );
}
