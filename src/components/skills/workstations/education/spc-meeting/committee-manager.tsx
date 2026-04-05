"use client";

import { useCallback, useEffect, useState } from "react";
import { X, Plus, Copy, Save, Loader2 } from "lucide-react";
import type { CommitteeMember } from "@/lib/education/committee-parser";

interface CommitteeManagerProps {
  year: number;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (members: CommitteeMember[]) => void;
}

const EMPTY_MEMBER: CommitteeMember = { order: 0, title: "", name: "", role: "委員", note: "" };

export function CommitteeManager({ year, isOpen, onClose, onSaved }: CommitteeManagerProps) {
  const [members, setMembers] = useState<CommitteeMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchRoster = useCallback(async (y: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/education/committee?year=${y}`);
      const data = await res.json();
      if (data.members) setMembers(data.members);
    } catch {
      // No roster found — start empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) fetchRoster(year);
  }, [isOpen, year, fetchRoster]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const numbered = members.map((m, i) => ({ ...m, order: i + 1 }));
      const res = await fetch("/api/education/committee", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, members: numbered }),
      });
      const data = await res.json();
      if (data.saved) {
        onSaved(numbered);
        onClose();
      }
    } catch (err) {
      console.error("Save committee failed:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyFromPrevious = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/education/committee/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromYear: year - 1, toYear: year }),
      });
      const data = await res.json();
      if (data.members) {
        setMembers(data.members);
      }
    } catch (err) {
      console.error("Copy committee failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const addMember = () => {
    setMembers([...members, { ...EMPTY_MEMBER, order: members.length + 1 }]);
  };

  const removeMember = (index: number) => {
    setMembers(members.filter((_, i) => i !== index));
  };

  const updateMember = (index: number, field: keyof CommitteeMember, value: string | number) => {
    setMembers(members.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-2xl rounded-xl border border-cy-border bg-cy-bg p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-cy-text">委員名冊管理 — {year} 學年度</h2>
          <button onClick={onClose} className="text-cy-muted hover:text-cy-text">
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-cy-muted" />
          </div>
        ) : (
          <>
            <div className="max-h-80 overflow-y-auto">
              <div className="grid grid-cols-[40px_1fr_80px_80px_1fr_32px] gap-1.5 text-[10px] text-cy-muted font-medium mb-1.5">
                <span>#</span>
                <span>職稱</span>
                <span>姓名</span>
                <span>身份</span>
                <span>備註</span>
                <span />
              </div>
              {members.map((member, i) => (
                <div key={i} className="grid grid-cols-[40px_1fr_80px_80px_1fr_32px] gap-1.5 mb-1">
                  <span className="flex items-center text-xs text-cy-muted">{i + 1}</span>
                  <input
                    value={member.title}
                    onChange={(e) => updateMember(i, "title", e.target.value)}
                    className="rounded border border-cy-border bg-cy-input px-2 py-1 text-xs text-cy-text focus:border-cy-accent focus:outline-none"
                  />
                  <input
                    value={member.name}
                    onChange={(e) => updateMember(i, "name", e.target.value)}
                    className="rounded border border-cy-border bg-cy-input px-2 py-1 text-xs text-cy-text focus:border-cy-accent focus:outline-none"
                  />
                  <select
                    value={member.role}
                    onChange={(e) => updateMember(i, "role", e.target.value)}
                    className="rounded border border-cy-border bg-cy-input px-1 py-1 text-xs text-cy-text focus:border-cy-accent focus:outline-none"
                  >
                    <option value="主席">主席</option>
                    <option value="委員">委員</option>
                    <option value="委員/記錄">委員/記錄</option>
                    <option value="記錄">記錄</option>
                  </select>
                  <input
                    value={member.note}
                    onChange={(e) => updateMember(i, "note", e.target.value)}
                    className="rounded border border-cy-border bg-cy-input px-2 py-1 text-xs text-cy-text focus:border-cy-accent focus:outline-none"
                  />
                  <button
                    onClick={() => removeMember(i)}
                    className="flex items-center justify-center text-cy-muted hover:text-cy-error"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={addMember}
              className="mt-2 flex items-center gap-1 text-xs text-cy-accent hover:text-cy-accent/80"
            >
              <Plus className="h-3 w-3" />
              新增委員
            </button>

            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={handleCopyFromPrevious}
                className="flex items-center gap-1.5 rounded-md border border-cy-border px-3 py-1.5 text-xs text-cy-muted hover:text-cy-text hover:border-cy-accent transition-colors"
              >
                <Copy className="h-3.5 w-3.5" />
                從 {year - 1} 學年複製
              </button>
              <div className="flex-1" />
              <button
                onClick={onClose}
                className="rounded-md px-3 py-1.5 text-xs text-cy-muted hover:text-cy-text transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-md bg-cy-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-cy-accent/90 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                儲存
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
