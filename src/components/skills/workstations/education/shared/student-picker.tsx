"use client";

import { Plus, X } from "lucide-react";

export interface StudentInfo {
  name: string;
  className: string;
  disability: string;
  detail?: string;
}

interface StudentPickerProps {
  value: StudentInfo[];
  onChange: (students: StudentInfo[]) => void;
}

const EMPTY_STUDENT: StudentInfo = { name: "", className: "", disability: "", detail: "" };

export function StudentPicker({ value, onChange }: StudentPickerProps) {
  const addStudent = () => onChange([...value, { ...EMPTY_STUDENT }]);

  const removeStudent = (index: number) => onChange(value.filter((_, i) => i !== index));

  const updateStudent = (index: number, field: keyof StudentInfo, val: string) => {
    const updated = value.map((s, i) => (i === index ? { ...s, [field]: val } : s));
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_80px_100px_1fr_32px] gap-1.5 text-[10px] text-cy-muted font-medium">
        <span>姓名</span>
        <span>班級</span>
        <span>障別程度</span>
        <span>備註</span>
        <span />
      </div>
      {value.map((student, i) => (
        <div key={i} className="grid grid-cols-[1fr_80px_100px_1fr_32px] gap-1.5">
          <input
            value={student.name}
            onChange={(e) => updateStudent(i, "name", e.target.value)}
            placeholder="姓名"
            className="rounded border border-cy-border bg-cy-input px-2 py-1 text-xs text-cy-text focus:border-cy-accent focus:outline-none"
          />
          <input
            value={student.className}
            onChange={(e) => updateStudent(i, "className", e.target.value)}
            placeholder="班級"
            className="rounded border border-cy-border bg-cy-input px-2 py-1 text-xs text-cy-text focus:border-cy-accent focus:outline-none"
          />
          <input
            value={student.disability}
            onChange={(e) => updateStudent(i, "disability", e.target.value)}
            placeholder="障別"
            className="rounded border border-cy-border bg-cy-input px-2 py-1 text-xs text-cy-text focus:border-cy-accent focus:outline-none"
          />
          <input
            value={student.detail ?? ""}
            onChange={(e) => updateStudent(i, "detail", e.target.value)}
            placeholder="備註"
            className="rounded border border-cy-border bg-cy-input px-2 py-1 text-xs text-cy-text focus:border-cy-accent focus:outline-none"
          />
          <button
            onClick={() => removeStudent(i)}
            className="flex items-center justify-center rounded text-cy-muted hover:text-cy-error transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button
        onClick={addStudent}
        className="flex items-center gap-1 text-xs text-cy-accent hover:text-cy-accent/80 transition-colors"
      >
        <Plus className="h-3 w-3" />
        新增學生
      </button>
    </div>
  );
}
