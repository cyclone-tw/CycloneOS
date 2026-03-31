"use client";

import { useEffect, useCallback } from "react";
import { useDriveStore } from "@/stores/drive-store";
import { DRIVE_ACCOUNTS } from "@/config/accounts";

const GOOGLE_NATIVE_EXTS = new Set([".gdoc", ".gsheet", ".gslides", ".gscript"]);

function isGoogleNative(name: string): boolean {
  const dot = name.lastIndexOf(".");
  return dot !== -1 && GOOGLE_NATIVE_EXTS.has(name.slice(dot).toLowerCase());
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getFullLocalPath(accountId: string, relativePath: string): string {
  const account = DRIVE_ACCOUNTS.find((a) => a.id === accountId);
  if (!account) return relativePath;
  return `${account.localBasePath}/${relativePath}`;
}

export function FileBrowser() {
  const {
    activeAccount,
    currentPath,
    files,
    selectedFile,
    isLoading,
    searchQuery,
    searchResults,
    error,
    setCurrentPath,
    setFiles,
    setSelectedFile,
    setIsLoading,
    setSearchQuery,
    setSearchResults,
    setError,
  } = useDriveStore();

  const fetchFiles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/drive/list?accountId=${activeAccount}&path=${encodeURIComponent(currentPath)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFiles(data.files);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load files");
    } finally {
      setIsLoading(false);
    }
  }, [activeAccount, currentPath, setFiles, setIsLoading, setError]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/drive/search?accountId=${activeAccount}&query=${encodeURIComponent(searchQuery)}&path=${encodeURIComponent(currentPath)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSearchResults(data.files);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setIsLoading(false);
    }
  };

  const navigateTo = (filePath: string) => {
    setCurrentPath(filePath);
    setSearchResults(null);
    setSearchQuery("");
  };

  const goUp = () => {
    if (currentPath === ".") return;
    const parts = currentPath.split("/");
    parts.pop();
    setCurrentPath(parts.length ? parts.join("/") : ".");
  };

  const handleFileClick = async (file: { name: string; path: string; isDirectory: boolean }) => {
    if (file.isDirectory) {
      navigateTo(file.path);
      return;
    }

    // Google native files: open in new tab
    if (isGoogleNative(file.name)) {
      try {
        const res = await fetch(
          `/api/drive/google-url?accountId=${activeAccount}&path=${encodeURIComponent(file.path)}`
        );
        const data = await res.json();
        if (data.url) {
          window.open(data.url, "_blank", "noopener,noreferrer");
          return;
        }
      } catch {
        // Fall through to normal preview
      }
    }

    setSelectedFile(file as typeof selectedFile);
  };

  const handleDragStart = (
    e: React.DragEvent,
    file: { name: string; path: string; isDirectory: boolean }
  ) => {
    const fullPath = getFullLocalPath(activeAccount, file.path);
    e.dataTransfer.setData("text/plain", fullPath);
    e.dataTransfer.setData("application/x-cyclone-drive-path", fullPath);
    e.dataTransfer.setData(
      "application/x-cyclone-drive-meta",
      JSON.stringify({ name: file.name, isDirectory: file.isDirectory, fullPath })
    );
    e.dataTransfer.effectAllowed = "copy";
  };

  const breadcrumbs = currentPath === "." ? ["root"] : ["root", ...currentPath.split("/")];
  const displayFiles = searchResults ?? files;

  return (
    <div className="flex flex-col gap-2">
      {/* Search */}
      <div className="flex gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="搜尋檔案..."
          className="flex-1 rounded-md border border-cy-input bg-cy-input/30 px-3 py-1.5 text-sm text-cy-text placeholder:text-cy-muted focus:outline-none focus:ring-1 focus:ring-cy-accent"
        />
        <button
          onClick={handleSearch}
          className="rounded-md bg-cy-accent/20 px-3 py-1.5 text-xs font-medium text-cy-accent hover:bg-cy-accent/30"
        >
          搜尋
        </button>
        {searchResults && (
          <button
            onClick={() => { setSearchResults(null); setSearchQuery(""); }}
            className="rounded-md px-3 py-1.5 text-xs text-cy-muted hover:text-cy-text"
          >
            清除
          </button>
        )}
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 text-xs text-cy-muted">
        {breadcrumbs.map((part, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span>/</span>}
            <button
              onClick={() => {
                if (i === 0) navigateTo(".");
                else navigateTo(breadcrumbs.slice(1, i + 1).join("/"));
              }}
              className="hover:text-cy-accent"
            >
              {part}
            </button>
          </span>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* File list */}
      <div className="flex flex-col rounded-md border border-cy-input/30">
        {/* Go up */}
        {currentPath !== "." && !searchResults && (
          <button
            onClick={goUp}
            className="flex items-center gap-2 border-b border-cy-input/20 px-3 py-2 text-sm text-cy-muted hover:bg-cy-input/20"
          >
            <span>📁</span>
            <span>..</span>
          </button>
        )}

        {isLoading ? (
          <div className="px-3 py-4 text-center text-sm text-cy-muted">
            載入中...
          </div>
        ) : displayFiles.length === 0 ? (
          <div className="px-3 py-4 text-center text-sm text-cy-muted">
            {searchResults ? "找不到符合的檔案" : "空資料夾"}
          </div>
        ) : (
          displayFiles.map((file) => (
            <button
              key={file.path}
              draggable
              onDragStart={(e) => handleDragStart(e, file)}
              onClick={() => handleFileClick(file)}
              className={`flex items-center gap-2 border-b border-cy-input/10 px-3 py-2 text-left text-sm transition-colors hover:bg-cy-input/20 ${
                selectedFile?.path === file.path ? "bg-cy-accent/10" : ""
              } ${isGoogleNative(file.name) ? "cursor-alias" : ""}`}
            >
              <span>
                {file.isDirectory
                  ? "📁"
                  : isGoogleNative(file.name)
                    ? "🔗"
                    : "📄"}
              </span>
              <span className="flex-1 truncate text-cy-text">{file.name}</span>
              <span className="text-xs text-cy-muted">{formatSize(file.size)}</span>
              <span className="text-xs text-cy-muted">{formatDate(file.modifiedAt)}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
