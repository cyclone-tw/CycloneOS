"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Loader2, RefreshCw, Check } from "lucide-react";
import { StudentPicker, type StudentInfo } from "../shared/student-picker";
import { HistoryReference, type HistoryRecord } from "../shared/history-reference";
import { RefFilePicker, type RefFile } from "./ref-file-picker";

export const PROPOSAL_TYPES = [
  "交通補助",
  "專團申請",
  "助理員申請",
  "酌減學生數",
  "轉安置",
  "課程計畫審議",
  "其他",
] as const;

export interface ProposalData {
  type: string;
  title: string;
  description: string;
  decision: string;
  students: StudentInfo[];
  refDoc: string;
  refFiles?: RefFile[];
}

interface ProposalFormProps {
  index: number;
  data: ProposalData;
  onChange: (data: ProposalData) => void;
  onRemove: () => void;
  canRemove: boolean;
  mode?: "prep" | "record";
}

export function ProposalForm({ index, data, onChange, onRemove, canRemove, mode = "record" }: ProposalFormProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [drafted, setDrafted] = useState(false);

  const update = (patch: Partial<ProposalData>) => onChange({ ...data, ...patch });

  const fetchHistory = async (type: string) => {
    if (!type || type === "其他") return;
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/education/spc-meeting/history?type=${encodeURIComponent(type)}&limit=5`);
      const result = await res.json();
      if (result.records) setHistoryRecords(result.records);
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleTypeChange = (type: string) => {
    update({ type });
    fetchHistory(type);
  };

  const handleDraft = async () => {
    setDrafting(true);
    setDrafted(false);
    try {
      const res = await fetch("/api/education/spc-meeting/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalType: data.type,
          students: data.students,
          refDoc: data.refDoc,
        }),
      });
      const result = await res.json();
      if (result.title) update({ title: result.title, description: result.description });
      setDrafted(true);
    } catch (err) {
      console.error("Draft failed:", err);
    } finally {
      setDrafting(false);
    }
  };

  return (
    <div className="rounded-lg border border-cy-border">
      <div className="flex items-center gap-2 border-b border-cy-border px-3 py-2">
        <button onClick={() => setCollapsed(!collapsed)} className="text-cy-muted hover:text-cy-text">
          {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>
        <span className="text-xs font-medium text-cy-text">案由 {index + 1}</span>
        {data.type && <span className="text-xs text-cy-muted">— {data.type}</span>}
        <div className="flex-1" />
        {canRemove && (
          <button onClick={onRemove} className="text-xs text-cy-muted hover:text-cy-error">
            移除
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="space-y-4 p-3">
          <div className="flex items-center gap-3">
            <label className="w-20 shrink-0 text-right text-xs text-cy-muted">案由類型</label>
            <select
              value={data.type}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="flex-1 rounded-md border border-cy-border bg-cy-input px-3 py-1.5 text-sm text-cy-text focus:border-cy-accent focus:outline-none"
            >
              <option value="">請選擇</option>
              {PROPOSAL_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-cy-muted">涉及學生</label>
            <StudentPicker
              value={data.students}
              onChange={(students) => update({ students })}
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="w-20 shrink-0 text-right text-xs text-cy-muted">公文字號</label>
            <input
              value={data.refDoc}
              onChange={(e) => update({ refDoc: e.target.value })}
              placeholder="選填"
              className="flex-1 rounded-md border border-cy-border bg-cy-input px-3 py-1.5 text-sm text-cy-text focus:border-cy-accent focus:outline-none"
            />
          </div>

          <RefFilePicker
            label="案由參考文件（公文、附件等）"
            files={data.refFiles ?? []}
            onChange={(refFiles) => update({ refFiles })}
          />

          <HistoryReference records={historyRecords} loading={historyLoading} />

          <div className="flex items-center gap-2">
            <button
              onClick={handleDraft}
              disabled={drafting || !data.type}
              className="flex items-center gap-1.5 rounded-md bg-cy-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-cy-accent/90 disabled:opacity-50 transition-colors"
            >
              {drafting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : drafted ? (
                <RefreshCw className="h-3.5 w-3.5" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              {drafting ? "AI 草擬中..." : drafted ? "重新生成" : "AI 草擬說明"}
            </button>
          </div>

          {(data.title || drafted) && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-cy-muted">【案由】</label>
              <input
                value={data.title}
                onChange={(e) => update({ title: e.target.value })}
                className="w-full rounded-md border border-cy-border bg-cy-input px-3 py-1.5 text-sm text-cy-text focus:border-cy-accent focus:outline-none"
              />
            </div>
          )}

          {(data.description || drafted) && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-cy-muted">【說明】</label>
              <textarea
                value={data.description}
                onChange={(e) => update({ description: e.target.value })}
                rows={6}
                className="w-full rounded-md border border-cy-border bg-cy-input px-3 py-2 text-sm text-cy-text focus:border-cy-accent focus:outline-none resize-y"
              />
            </div>
          )}

          {mode === "record" && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-cy-muted">【決議】</label>
              <textarea
                value={data.decision}
                onChange={(e) => update({ decision: e.target.value })}
                placeholder="（會後填入）"
                rows={3}
                className="w-full rounded-md border border-cy-border bg-cy-input px-3 py-2 text-sm text-cy-text focus:border-cy-accent focus:outline-none resize-y"
              />
            </div>
          )}
          {mode === "prep" && (
            <div className="rounded-md bg-cy-input/30 px-3 py-2 text-xs text-cy-muted italic">
              決議將在記錄模式中填寫
            </div>
          )}
        </div>
      )}
    </div>
  );
}
