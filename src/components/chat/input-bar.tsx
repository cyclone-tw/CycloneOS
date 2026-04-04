"use client";

import { useState, useRef, useCallback } from "react";
import { useAgentStore } from "@/stores/agent-store";
import { PermissionBadge } from "./permission-badge";
import { ModelSelector } from "./model-selector";
import { ProviderSelector } from "./provider-selector";
import { Square, ArrowUp, X, Paperclip, FileText, Image as ImageIcon, Film, Music, FileCode } from "lucide-react";
import type { FileAttachment } from "@/types/chat";

const MIME_MAP: Record<string, string> = {
  pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", html: "text/html",
  md: "text/markdown", txt: "text/plain", json: "application/json", csv: "text/csv",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
  mp3: "audio/mpeg", mp4: "video/mp4", wav: "audio/wav",
};

function guessMimeType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return MIME_MAP[ext] ?? "application/octet-stream";
}

function extractLocalPaths(text: string): string[] {
  const paths: string[] = [];
  for (const line of text.split(/[\r\n]+/)) {
    const trimmed = line.trim();
    // file:// URI → local path
    if (trimmed.startsWith("file://")) {
      try {
        const decoded = decodeURIComponent(trimmed.replace("file://", ""));
        if (decoded.startsWith("/")) paths.push(decoded);
      } catch { /* skip */ }
    }
    // Direct absolute path
    else if (trimmed.startsWith("/") && !trimmed.includes("\n")) {
      paths.push(trimmed);
    }
  }
  return paths;
}

interface InputBarProps {
  onSend: (text: string, files?: FileAttachment[]) => void;
  onStop: () => void;
  isStreaming: boolean;
}

const FILE_ICONS: Record<string, typeof FileText> = {
  "image/": ImageIcon,
  "video/": Film,
  "audio/": Music,
  "text/": FileCode,
};

function getFileIcon(mimeType: string) {
  for (const [prefix, Icon] of Object.entries(FILE_ICONS)) {
    if (mimeType.startsWith(prefix)) return Icon;
  }
  return FileText;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function InputBar({ onSend, onStop, isStreaming }: InputBarProps) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { enterToSend, setEnterToSend } = useAgentStore();

  const uploadAndAddFiles = useCallback(async (fileList: File[]) => {
    if (fileList.length === 0) return;
    setUploading(true);

    try {
      // Upload to server with 30s timeout
      const form = new FormData();
      for (const f of fileList) form.append("files", f);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      const res = await fetch("/api/agents/upload", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) throw new Error("Upload failed");
      const { files: uploaded } = await res.json();

      // Build attachments with tempPath + preview for images
      const attachments: FileAttachment[] = fileList.map((f, i) => ({
        name: f.name,
        mimeType: f.type || "application/octet-stream",
        size: f.size,
        previewUrl: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined,
        tempPath: uploaded[i]?.path,
      }));

      setFiles((prev) => [...prev, ...attachments]);
    } catch {
      // On failure, still show files but without tempPath
      const attachments: FileAttachment[] = fileList.map((f) => ({
        name: f.name,
        mimeType: f.type || "application/octet-stream",
        size: f.size,
        previewUrl: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined,
      }));
      setFiles((prev) => [...prev, ...attachments]);
    } finally {
      setUploading(false);
    }
  }, []);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const pastedFiles: File[] = [];
      for (const item of Array.from(items)) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) pastedFiles.push(file);
        }
      }
      if (pastedFiles.length > 0) {
        e.preventDefault();
        uploadAndAddFiles(pastedFiles);
      }
    },
    [uploadAndAddFiles]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);

      // 1. CycloneOS Drive panel meta (internal drag)
      const meta = e.dataTransfer.getData("application/x-cyclone-drive-meta");
      if (meta) {
        try {
          const { isDirectory, fullPath } = JSON.parse(meta);
          const prefix = isDirectory
            ? `請讀取以下資料夾的內容：\n`
            : `請讀取以下檔案：\n`;
          const newText = `${prefix}${fullPath}`;
          setText((prev) => (prev ? `${prev}\n\n${newText}` : newText));
          textareaRef.current?.focus();
          return;
        } catch { /* fall through */ }
      }

      // 2. System files from Finder / desktop
      if (e.dataTransfer.files.length > 0) {
        const droppedFiles = Array.from(e.dataTransfer.files);

        // Check if we can get local file paths (Electron/tauri would, browser won't)
        // For browser: use File System Access API path hint, or fall back to upload
        // Approach: if files are from a known local mount (Google Drive, etc.),
        // the text/uri-list may contain file:// URIs with full paths
        const uriList = e.dataTransfer.getData("text/uri-list");
        const plainText = e.dataTransfer.getData("text/plain");

        // Try to extract file:// paths from URI list or plain text
        const localPaths = extractLocalPaths(uriList || plainText || "");

        if (localPaths.length > 0) {
          // We have local paths — inject as file references (no upload needed)
          const fileEntries: FileAttachment[] = localPaths.map((p, i) => ({
            name: droppedFiles[i]?.name || p.split("/").pop() || "file",
            mimeType: droppedFiles[i]?.type || guessMimeType(p),
            size: droppedFiles[i]?.size || 0,
            tempPath: p,
          }));
          setFiles((prev) => [...prev, ...fileEntries]);
          return;
        }

        // No local paths available — upload to temp
        uploadAndAddFiles(droppedFiles);
        return;
      }

      // 3. Plain text path (e.g. from terminal)
      const plainPath = e.dataTransfer.getData("text/plain");
      if (plainPath && plainPath.startsWith("/")) {
        setText((prev) => (prev ? `${prev}\n\n${plainPath}` : plainPath));
        textareaRef.current?.focus();
      }
    },
    [uploadAndAddFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => {
      const removed = prev[index];
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if ((!trimmed && files.length === 0) || isStreaming || uploading) return;
    onSend(trimmed, files.length > 0 ? files : undefined);
    setText("");
    setFiles([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    textareaRef.current?.focus();
  }, [text, files, isStreaming, uploading, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      if (enterToSend) {
        e.preventDefault();
        handleSend();
      }
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  const hasContent = text.trim().length > 0 || files.length > 0;

  return (
    <div
      className={`border-t border-cy-input/30 bg-cy-card/80 px-3 py-2.5 backdrop-blur-sm transition-colors ${
        dragOver ? "bg-cy-accent/10 ring-2 ring-inset ring-cy-accent/40" : ""
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {dragOver && (
        <div className="mb-2 flex items-center justify-center gap-2 rounded-lg bg-cy-accent/10 py-2 text-xs text-cy-accent">
          <Paperclip className="h-3.5 w-3.5" />
          放開以加入檔案
        </div>
      )}

      {/* Uploading indicator */}
      {uploading && (
        <div className="mb-2 flex items-center gap-2 text-xs text-cy-muted">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-cy-accent border-t-transparent" />
          上傳中...
        </div>
      )}

      {/* File previews */}
      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {files.map((file, i) => (
            <div key={i} className="group relative">
              {file.previewUrl ? (
                <div className="h-16 w-16 overflow-hidden rounded-lg border border-cy-input/50">
                  <img
                    src={file.previewUrl}
                    alt={file.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-1.5 rounded-lg border border-cy-input/50 bg-cy-bg/60 px-2.5 py-1.5">
                  {(() => {
                    const Icon = getFileIcon(file.mimeType);
                    return <Icon className="h-3.5 w-3.5 text-cy-muted" />;
                  })()}
                  <span className="max-w-[120px] truncate text-xs text-cy-text/80">{file.name}</span>
                  <span className="text-xs text-cy-muted">{formatSize(file.size)}</span>
                </div>
              )}
              <button
                onClick={() => removeFile(i)}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-cy-bg border border-cy-input/50 text-cy-muted opacity-0 transition-opacity hover:text-cy-error group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) uploadAndAddFiles(Array.from(e.target.files));
          e.target.value = "";
        }}
      />

      {/* Input row */}
      <div className="flex items-end gap-2">
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={files.length > 0 ? "描述這些檔案..." : "Message CycloneOS..."}
            disabled={isStreaming}
            rows={1}
            className="w-full resize-none rounded-xl border border-cy-input/50 bg-cy-bg/80 py-2.5 pl-10 pr-12 text-sm text-cy-text placeholder:text-cy-muted/80 focus:border-cy-accent/50 focus:outline-none disabled:opacity-50"
          />
          {/* Attach button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isStreaming}
            className="absolute bottom-2 left-2.5 flex h-7 w-7 items-center justify-center rounded-lg text-cy-muted transition-colors hover:bg-cy-input/40 hover:text-cy-text disabled:opacity-50"
            title="附加檔案"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          {/* Send / Stop button */}
          <div className="absolute bottom-1.5 right-1.5">
            {isStreaming ? (
              <button
                onClick={onStop}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-cy-error/80 text-white transition-colors hover:bg-cy-error"
                title="停止生成"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!hasContent || uploading}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-cy-accent text-cy-bg transition-colors hover:bg-cy-accent/80 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Controls row */}
      <div className="mt-1.5 flex items-center gap-3">
        <ProviderSelector />
        <PermissionBadge />
        <ModelSelector />
        <div className="flex-1" />
        {files.length > 0 && (
          <span className="text-xs text-cy-muted/80">
            {files.length} 個檔案
          </span>
        )}
        <button
          onClick={() => setEnterToSend(!enterToSend)}
          className="flex items-center gap-1.5 text-xs text-cy-muted transition-colors hover:text-cy-text"
          title={enterToSend ? "Enter 送出（點擊關閉）" : "僅按鈕送出（點擊開啟 Enter 送出）"}
        >
          <span
            className={`inline-block h-2.5 w-5 rounded-full transition-colors ${enterToSend ? "bg-cy-accent" : "bg-cy-input"}`}
          >
            <span
              className={`mt-px block h-2 w-2 rounded-full bg-white transition-transform ${enterToSend ? "translate-x-2.5" : "translate-x-0.5"}`}
            />
          </span>
          {enterToSend ? "Enter 送出" : "僅按鈕送出"}
        </button>
      </div>
    </div>
  );
}
