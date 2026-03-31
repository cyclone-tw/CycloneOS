"use client";

import { useCallback, useEffect, useState } from "react";
import {
  X,
  FileText,
  Folder,
  ChevronRight,
  HardDrive,
  Cloud,
  BookOpen,
  Archive,
  Check,
  ArrowLeft,
} from "lucide-react";
import { type SourceItem } from "@/stores/documents-store";

type TabId = "local" | "drive" | "notion" | "obsidian";

interface BrowseItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
}

interface SharedSourcePickerModalProps {
  open: boolean;
  onClose: () => void;
  onAddSources: (sources: SourceItem[]) => void;
  initialPath?: string;
  initialTab?: TabId;
  /** Override the source type for all items selected from this modal */
  sourceTypeOverride?: SourceItem["type"];
}

const CLOUD_STORAGE_ROOT = "~/Library/CloudStorage";

const TABS: { id: TabId; label: string; icon: React.ReactNode; enabled: boolean }[] = [
  { id: "local", label: "本機", icon: <HardDrive className="h-3.5 w-3.5" />, enabled: true },
  { id: "drive", label: "Google Drive", icon: <Cloud className="h-3.5 w-3.5" />, enabled: true },
  { id: "notion", label: "Notion", icon: <BookOpen className="h-3.5 w-3.5" />, enabled: false },
  { id: "obsidian", label: "Obsidian", icon: <Archive className="h-3.5 w-3.5" />, enabled: false },
];

function formatSize(bytes: number): string {
  if (bytes === 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SharedSourcePickerModal({ open, onClose, onAddSources, initialPath, initialTab, sourceTypeOverride }: SharedSourcePickerModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab ?? "local");
  const [currentPath, setCurrentPath] = useState(initialPath ?? "~");
  const [displayPath, setDisplayPath] = useState("~");
  const [items, setItems] = useState<BrowseItem[]>([]);
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const browse = useCallback(async (path: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/browse?path=${encodeURIComponent(path)}`);
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Failed to browse");
        return;
      }
      const data = await res.json();
      setItems(data.items ?? []);
      setDisplayPath(data.path ?? path);
      setParentPath(data.parent !== data.path ? data.parent : null);
      setCurrentPath(path);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Browse failed");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Reset to initial state when modal opens
  useEffect(() => {
    if (!open) return;
    const tab = initialTab ?? "local";
    setActiveTab(tab);
    if (initialPath) {
      browse(initialPath);
    } else if (tab === "local") {
      browse(currentPath);
    } else if (tab === "drive") {
      browse(CLOUD_STORAGE_ROOT);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Browse on tab change (after initial open)
  useEffect(() => {
    if (!open) return;
    if (activeTab === "local" && !initialPath) {
      browse(currentPath);
    } else if (activeTab === "drive") {
      browse(CLOUD_STORAGE_ROOT);
    } else if (activeTab === "local" && initialPath) {
      browse(initialPath);
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSelect = (item: BrowseItem) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(item.path)) {
        next.delete(item.path);
      } else {
        next.add(item.path);
      }
      return next;
    });
  };

  const handleNavigate = (item: BrowseItem) => {
    if (item.isDirectory) {
      setSelected(new Set());
      browse(item.path);
    }
  };

  const handleConfirm = () => {
    const sources: SourceItem[] = [];
    for (const path of selected) {
      const item = items.find((i) => i.path === path);
      if (item) {
        const inferredType = activeTab === "drive" ? "drive" : "local";
        sources.push({
          id: crypto.randomUUID(),
          type: sourceTypeOverride ?? inferredType,
          path: item.path,
          name: item.name,
          isDirectory: item.isDirectory,
        });
      }
    }
    if (sources.length > 0) onAddSources(sources);
    setSelected(new Set());
    onClose();
  };

  const handleClose = () => {
    setSelected(new Set());
    onClose();
  };

  // Breadcrumb from displayPath
  const breadcrumbs = displayPath.split("/").filter(Boolean);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="flex max-h-[70vh] w-[560px] flex-col rounded-xl border border-cy-border bg-cy-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-cy-border px-4 py-3">
          <h2 className="text-sm font-bold text-cy-text">選擇來源</h2>
          <button
            onClick={handleClose}
            className="rounded p-1 text-cy-muted hover:bg-cy-input/50 hover:text-cy-text transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-cy-border px-4 py-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => tab.enabled && setActiveTab(tab.id)}
              disabled={!tab.enabled}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-cy-accent/15 text-cy-accent"
                  : tab.enabled
                    ? "text-cy-muted hover:bg-cy-input/50 hover:text-cy-text"
                    : "text-cy-muted/30 cursor-not-allowed"
              }`}
            >
              {tab.icon}
              {tab.label}
              {!tab.enabled && <span className="text-[10px] opacity-50">Soon</span>}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === "local" || activeTab === "drive" ? (
            <div className="flex h-full flex-col">
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

              {/* File list */}
              <div className="flex-1 overflow-y-auto px-2 py-1" style={{ maxHeight: "340px" }}>
                {isLoading && (
                  <div className="flex items-center justify-center py-8 text-sm text-cy-muted">
                    載入中...
                  </div>
                )}
                {error && (
                  <div className="flex items-center justify-center py-8 text-sm text-cy-error">
                    {error}
                  </div>
                )}
                {!isLoading && !error && items.length === 0 && (
                  <div className="flex items-center justify-center py-8 text-sm text-cy-muted">
                    此目錄為空
                  </div>
                )}
                {!isLoading &&
                  !error &&
                  items.map((item) => (
                    <div
                      key={item.path}
                      className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors cursor-pointer ${
                        selected.has(item.path)
                          ? "bg-cy-accent/10 text-cy-text"
                          : "text-cy-text hover:bg-cy-input/40"
                      }`}
                      onClick={() => (item.isDirectory ? handleNavigate(item) : toggleSelect(item))}
                    >
                      {/* Checkbox for files, folder icon for dirs */}
                      {item.isDirectory ? (
                        <div
                          className="flex h-4 w-4 shrink-0 items-center justify-center"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelect(item);
                          }}
                        >
                          {selected.has(item.path) ? (
                            <div className="flex h-3.5 w-3.5 items-center justify-center rounded bg-cy-accent">
                              <Check className="h-2.5 w-2.5 text-cy-bg" />
                            </div>
                          ) : (
                            <Folder className="h-3.5 w-3.5 text-cy-accent" />
                          )}
                        </div>
                      ) : (
                        <div
                          className="flex h-4 w-4 shrink-0 items-center justify-center"
                        >
                          {selected.has(item.path) ? (
                            <div className="flex h-3.5 w-3.5 items-center justify-center rounded bg-cy-accent">
                              <Check className="h-2.5 w-2.5 text-cy-bg" />
                            </div>
                          ) : (
                            <FileText className="h-3.5 w-3.5 text-cy-muted" />
                          )}
                        </div>
                      )}

                      <span className="flex-1 truncate">{item.name}</span>

                      {item.isDirectory ? (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-cy-muted/50" />
                      ) : (
                        <span className="shrink-0 text-xs text-cy-muted/60">
                          {formatSize(item.size)}
                        </span>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            /* Placeholder for other tabs */
            <div className="flex h-[340px] flex-col items-center justify-center gap-2 text-cy-muted">
              {TABS.find((t) => t.id === activeTab)?.icon}
              <p className="text-sm">
                {activeTab === "notion" && "Notion 整合即將推出"}
                {activeTab === "obsidian" && "Obsidian 整合即將推出"}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-cy-border px-4 py-3">
          <span className="text-xs text-cy-muted">
            已選取：{selected.size} 個{selected.size > 0 ? "項目" : ""}
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleClose}
              className="rounded-md px-3 py-1.5 text-xs text-cy-muted hover:bg-cy-input/50 hover:text-cy-text transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              disabled={selected.size === 0}
              className={`rounded-md px-4 py-1.5 text-xs font-medium transition-all ${
                selected.size > 0
                  ? "bg-cy-accent text-cy-bg hover:bg-cy-accent/90"
                  : "bg-cy-input/50 text-cy-muted cursor-not-allowed"
              }`}
            >
              確認新增
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
