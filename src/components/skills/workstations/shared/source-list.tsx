"use client";

import { useCallback, useState } from "react";
import { Plus, X, FileText, Folder, HardDrive, Cloud, BookOpen, Archive, Type, Search } from "lucide-react";
import { type SourceItem } from "@/stores/documents-store";
import { SharedSourcePickerModal } from "./source-picker-modal";

const SOURCE_TYPE_ICON: Record<SourceItem["type"], React.ReactNode> = {
  local: <HardDrive className="h-3 w-3" />,
  drive: <Cloud className="h-3 w-3" />,
  notion: <BookOpen className="h-3 w-3" />,
  obsidian: <Archive className="h-3 w-3" />,
  text: <Type className="h-3 w-3" />,
  research: <Search className="h-3 w-3" />,
};

interface SharedSourceListProps {
  sources: SourceItem[];
  onAddSources: (sources: SourceItem[]) => void;
  onRemoveSource: (id: string) => void;
}

export function SharedSourceList({ sources, onAddSources, onRemoveSource }: SharedSourceListProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const items: SourceItem[] = [];
      const files = e.dataTransfer.files;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const path = (file as unknown as { path?: string }).path || file.name;
        items.push({
          id: crypto.randomUUID(),
          type: "local",
          path,
          name: file.name,
          isDirectory: false,
        });
      }
      if (items.length > 0) onAddSources(items);
    },
    [onAddSources]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-cy-text">📥 來源</h3>
        <span className="text-xs text-cy-muted">{sources.length} 個</span>
      </div>

      {/* Source items */}
      {sources.length > 0 && (
        <div className="space-y-1">
          {sources.map((src) => (
            <div
              key={src.id}
              className="flex items-center gap-2 rounded-md bg-cy-input/40 px-2.5 py-1.5 text-sm"
            >
              {src.isDirectory ? (
                <Folder className="h-3.5 w-3.5 shrink-0 text-cy-accent" />
              ) : (
                <FileText className="h-3.5 w-3.5 shrink-0 text-cy-muted" />
              )}
              <span className="flex-1 truncate text-cy-text">{src.name}</span>
              <span className="shrink-0 text-cy-muted/50" title={src.type}>
                {SOURCE_TYPE_ICON[src.type]}
              </span>
              <button
                onClick={() => onRemoveSource(src.id)}
                className="shrink-0 rounded p-0.5 text-cy-muted hover:bg-cy-error/20 hover:text-cy-error transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add source button */}
      <button
        onClick={() => setPickerOpen(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-cy-border bg-cy-input/30 py-2 text-xs text-cy-muted hover:border-cy-muted/40 hover:text-cy-text transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        新增來源
      </button>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed py-3 transition-colors ${
          isDragOver
            ? "border-cy-accent bg-cy-accent/10 text-cy-accent"
            : "border-cy-border/50 text-cy-muted/50 hover:border-cy-muted/30"
        }`}
      >
        <span className="text-xs">或拖放檔案到這裡</span>
      </div>

      {/* Source Picker Modal */}
      <SharedSourcePickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onAddSources={onAddSources}
      />
    </div>
  );
}
