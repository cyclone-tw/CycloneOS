// src/components/skills/workstations/education/spc-meeting/ref-file-picker.tsx
"use client";

import { SharedSourceList } from "../../shared/source-list";
import type { SourceItem } from "@/stores/documents-store";

export interface RefFile {
  id: string;
  path: string;
  name: string;
  isDirectory: boolean;
}

interface RefFilePickerProps {
  label: string;
  files: RefFile[];
  onChange: (files: RefFile[]) => void;
}

export function RefFilePicker({ label, files, onChange }: RefFilePickerProps) {
  const sources: SourceItem[] = files.map((f) => ({
    id: f.id,
    type: "local" as const,
    path: f.path,
    name: f.name,
    isDirectory: f.isDirectory,
  }));

  const handleAdd = (newSources: SourceItem[]) => {
    const newFiles: RefFile[] = newSources.map((s) => ({
      id: s.id,
      path: s.path,
      name: s.name,
      isDirectory: s.isDirectory,
    }));
    onChange([...files, ...newFiles]);
  };

  const handleRemove = (id: string) => {
    onChange(files.filter((f) => f.id !== id));
  };

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-cy-muted">{label}</label>
      <SharedSourceList
        sources={sources}
        onAddSources={handleAdd}
        onRemoveSource={handleRemove}
      />
    </div>
  );
}
