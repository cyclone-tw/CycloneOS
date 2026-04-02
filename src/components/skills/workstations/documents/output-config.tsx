"use client";

import { useCallback, useEffect, useState } from "react";
import { FolderOpen, HardDrive, Cloud, ChevronRight, ArrowLeft, X } from "lucide-react";
import { useDocumentsStore, type OutputFormat } from "@/stores/documents-store";

const FORMAT_OPTIONS: { value: OutputFormat; label: string; enabled: boolean }[] = [
  { value: "md", label: "Markdown (.md)", enabled: true },
  { value: "docx", label: "DOCX (.docx)", enabled: true },
  { value: "pdf", label: "PDF (.pdf)", enabled: true },
  { value: "xlsx", label: "Excel (.xlsx)", enabled: true },
];

interface BrowseItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
}

type PathTarget = "local" | "drive";

function OutputPathPicker({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (path: string, target: PathTarget) => void;
}) {
  const [activeTab, setActiveTab] = useState<PathTarget>("local");
  const [currentPath, setCurrentPath] = useState("~");
  const [displayPath, setDisplayPath] = useState("~");
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [items, setItems] = useState<BrowseItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const browse = useCallback(async (path: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/documents/browse?path=${encodeURIComponent(path)}`);
      if (!res.ok) return;
      const data = await res.json();
      setItems((data.items ?? []).filter((i: BrowseItem) => i.isDirectory));
      setDisplayPath(data.path ?? path);
      setParentPath(data.parent !== data.path ? data.parent : null);
      setCurrentPath(path);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && activeTab === "local") browse(currentPath);
  }, [open, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="flex max-h-[60vh] w-[440px] flex-col rounded-xl border border-cy-border bg-cy-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-cy-border px-4 py-3">
          <h2 className="text-sm font-bold text-cy-text">選擇存放位置</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-cy-muted hover:bg-cy-input/50 hover:text-cy-text transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-cy-border px-4 py-2">
          <button
            onClick={() => setActiveTab("local")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "local"
                ? "bg-cy-accent/15 text-cy-accent"
                : "text-cy-muted hover:bg-cy-input/50 hover:text-cy-text"
            }`}
          >
            <HardDrive className="h-3.5 w-3.5" />
            本機
          </button>
          <button
            onClick={() => setActiveTab("drive")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "drive"
                ? "bg-cy-accent/15 text-cy-accent"
                : "text-cy-muted hover:bg-cy-input/50 hover:text-cy-text"
            }`}
          >
            <Cloud className="h-3.5 w-3.5" />
            Google Drive
            <span className="text-[10px] opacity-50">Soon</span>
          </button>
        </div>

        {/* Content */}
        {activeTab === "local" ? (
          <div className="flex flex-col">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1 border-b border-cy-border/50 px-4 py-2 text-xs text-cy-muted">
              {parentPath && (
                <button
                  onClick={() => browse(parentPath)}
                  className="mr-1 rounded p-0.5 hover:bg-cy-input/50 hover:text-cy-text transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
              )}
              <span className="truncate text-cy-text">{displayPath}</span>
            </div>

            {/* Folder list — only directories */}
            <div className="overflow-y-auto px-2 py-1" style={{ maxHeight: "260px" }}>
              {isLoading && (
                <div className="py-6 text-center text-sm text-cy-muted">載入中...</div>
              )}
              {!isLoading && items.length === 0 && (
                <div className="py-6 text-center text-sm text-cy-muted">沒有子資料夾</div>
              )}
              {!isLoading &&
                items.map((item) => (
                  <div
                    key={item.path}
                    onClick={() => browse(item.path)}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm text-cy-text hover:bg-cy-input/40 transition-colors"
                  >
                    <FolderOpen className="h-3.5 w-3.5 shrink-0 text-cy-accent" />
                    <span className="flex-1 truncate">{item.name}</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-cy-muted/50" />
                  </div>
                ))}
            </div>
          </div>
        ) : (
          <div className="flex h-[260px] flex-col items-center justify-center gap-2 text-cy-muted">
            <Cloud className="h-6 w-6 opacity-40" />
            <p className="text-sm">Google Drive 存放即將推出</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-cy-border px-4 py-3">
          <span className="truncate text-xs text-cy-muted">{displayPath}</span>
          <button
            onClick={() => {
              onSelect(displayPath, activeTab);
              onClose();
            }}
            className="rounded-md bg-cy-accent px-4 py-1.5 text-xs font-medium text-cy-bg hover:bg-cy-accent/90 transition-colors"
          >
            選擇此資料夾
          </button>
        </div>
      </div>
    </div>
  );
}

export function OutputConfig() {
  const { currentSession, toggleFormat, setOutputPath } = useDocumentsStore();
  const formats = currentSession?.outputFormats ?? [];
  const outputPath = currentSession?.outputPath ?? "~/Desktop";
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-cy-text">📤 輸出</h3>

      {/* Format checkboxes */}
      <div className="space-y-1.5">
        {FORMAT_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={`flex items-center gap-2 text-sm ${
              opt.enabled ? "cursor-pointer text-cy-text" : "cursor-not-allowed text-cy-muted/50"
            }`}
          >
            <input
              type="checkbox"
              checked={formats.includes(opt.value)}
              onChange={() => opt.enabled && toggleFormat(opt.value)}
              disabled={!opt.enabled}
              className="h-3.5 w-3.5 rounded border-cy-border accent-cy-accent"
            />
            {opt.label}
            {!opt.enabled && <span className="text-xs text-cy-muted/40">Soon</span>}
          </label>
        ))}
      </div>

      {/* Output path — clickable to browse */}
      <div className="space-y-1">
        <label className="text-xs text-cy-muted">存放路徑</label>
        <button
          onClick={() => setPickerOpen(true)}
          className="flex w-full items-center gap-2 rounded-md bg-cy-input/50 px-2.5 py-2 text-left text-sm text-cy-text hover:bg-cy-input/70 transition-colors"
        >
          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-cy-accent" />
          <span className="flex-1 truncate">{outputPath}</span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-cy-muted/50" />
        </button>
      </div>

      {/* Path picker modal */}
      <OutputPathPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(path) => setOutputPath(path)}
      />
    </div>
  );
}
