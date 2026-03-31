"use client";

import { useEffect, useState, useCallback } from "react";
import { useDriveStore } from "@/stores/drive-store";
import { X, ZoomIn, CloudDownload } from "lucide-react";
import { lookup } from "mime-types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ViewMode = "rendered" | "source";

function isMarkdown(name: string, mimeType: string): boolean {
  return (
    name.endsWith(".md") ||
    name.endsWith(".mdx") ||
    mimeType === "text/markdown"
  );
}

function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>
      <img
        src={src}
        alt={alt}
        className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1.5 text-xs text-white/80">
        {alt} — ESC 或點擊外部關閉
      </div>
    </div>
  );
}

export function FilePreview() {
  const { activeAccount, selectedFile } = useDriveStore();
  const [content, setContent] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("");
  const [encoding, setEncoding] = useState<string>("");
  const [binaryMessage, setBinaryMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("載入中...");
  const [viewMode, setViewMode] = useState<ViewMode>("rendered");
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    if (!selectedFile) {
      setContent(null);
      return;
    }

    // Skip JSON fetch for image files — they use /api/drive/image directly
    if (selectedFile.name.match(/\.(jpe?g|png|gif|webp|bmp|svg|ico)$/i)) {
      setContent(null);
      setMimeType(lookup(selectedFile.name) || "image/png");
      setEncoding("");
      setIsLoading(false);
      setViewMode("rendered");
      setLightboxOpen(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setLoadingMessage("載入中...");
    setBinaryMessage(null);
    setViewMode("rendered");
    setLightboxOpen(false);

    async function fetchFile(retries = 1) {
      const url = `/api/drive/read?accountId=${activeAccount}&path=${encodeURIComponent(selectedFile!.path)}`;
      try {
        const res = await fetch(url);
        const data = await res.json();
        if (cancelled) return;

        if (res.status === 504 && data.error === "cloud_timeout" && retries > 0) {
          setLoadingMessage("正在從雲端下載，請稍候...");
          await new Promise((r) => setTimeout(r, 5000));
          if (!cancelled) return fetchFile(retries - 1);
          return;
        }

        if (data.binary || data.error === "unreadable") {
          setBinaryMessage(data.message ?? "無法預覽此檔案類型");
          setContent(null);
        } else {
          setContent(data.content ?? null);
        }
        setMimeType(data.mimeType ?? "");
        setEncoding(data.encoding ?? "");
      } catch {
        if (!cancelled) setContent(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchFile();
    return () => { cancelled = true; };
  }, [activeAccount, selectedFile]);

  const closeLightbox = useCallback(() => setLightboxOpen(false), []);

  if (!selectedFile) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-cy-muted">
        選擇一個檔案來預覽
      </div>
    );
  }

  const isMd = isMarkdown(selectedFile.name, mimeType);
  const isText = content !== null && encoding !== "base64";
  const isImage = encoding === "base64" && mimeType.startsWith("image/");
  // For images loaded via base64 JSON, use data URL; otherwise detect by file extension
  const isImageFile = selectedFile.name.match(/\.(jpe?g|png|gif|webp|bmp|svg|ico)$/i);
  const imageSrc = isImage
    ? `data:${mimeType};base64,${content}`
    : isImageFile
      ? `/api/drive/image?accountId=${activeAccount}&path=${encodeURIComponent(selectedFile.path)}`
      : "";

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="truncate text-sm font-medium text-cy-text">
          {selectedFile.name}
        </h3>
        <div className="flex items-center gap-2">
          {isMd && isText && (
            <div className="flex rounded border border-cy-input/40 text-xs">
              <button
                onClick={() => setViewMode("rendered")}
                className={`px-2 py-0.5 transition-colors ${
                  viewMode === "rendered"
                    ? "bg-cy-accent/20 text-cy-accent"
                    : "text-cy-muted hover:text-cy-text"
                }`}
              >
                預覽
              </button>
              <button
                onClick={() => setViewMode("source")}
                className={`px-2 py-0.5 transition-colors ${
                  viewMode === "source"
                    ? "bg-cy-accent/20 text-cy-accent"
                    : "text-cy-muted hover:text-cy-text"
                }`}
              >
                原始碼
              </button>
            </div>
          )}
          <span className="text-xs text-cy-muted">{mimeType}</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto rounded-md border border-cy-input/30 bg-cy-card p-3">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-cy-muted">
            {loadingMessage.includes("雲端") && (
              <CloudDownload className="h-4 w-4 animate-pulse" />
            )}
            <span>{loadingMessage}</span>
          </div>
        ) : isImageFile && !isImage ? (
          // Large images: use direct image endpoint (avoids base64 JSON)
          <div className="group relative inline-block">
            <img
              src={imageSrc}
              alt={selectedFile.name}
              className="max-w-full cursor-pointer rounded transition-opacity hover:opacity-90"
              onClick={() => setLightboxOpen(true)}
            />
            <button
              onClick={() => setLightboxOpen(true)}
              className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>
        ) : content === null ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-sm text-cy-muted">
            <span>{binaryMessage ?? "無法預覽此檔案類型"}</span>
            {mimeType && <span className="text-xs opacity-60">{mimeType}</span>}
          </div>
        ) : isImage ? (
          <div className="group relative inline-block">
            <img
              src={imageSrc}
              alt={selectedFile.name}
              className="max-w-full cursor-pointer rounded transition-opacity hover:opacity-90"
              onClick={() => setLightboxOpen(true)}
            />
            <button
              onClick={() => setLightboxOpen(true)}
              className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>
        ) : isMd && viewMode === "rendered" ? (
          <div className="prose prose-invert prose-sm max-w-none prose-headings:text-cy-text prose-p:text-cy-text/80 prose-a:text-cy-accent prose-a:no-underline hover:prose-a:underline prose-strong:text-cy-text prose-code:text-cy-accent/80 prose-code:before:content-none prose-code:after:content-none prose-pre:bg-cy-bg/80 prose-pre:border prose-pre:border-cy-input/30 prose-li:text-cy-text/80 prose-th:text-cy-text/85 prose-td:text-cy-text/85 prose-hr:border-cy-input/30">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ href, children, ...props }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    {...props}
                  >
                    {children}
                  </a>
                ),
              }}
            >
              {content.length > 50000
                ? content.slice(0, 50000) + "\n\n... (truncated)"
                : content}
            </ReactMarkdown>
          </div>
        ) : (
          <pre className="whitespace-pre-wrap text-xs text-cy-text">
            {content.length > 50000
              ? content.slice(0, 50000) + "\n\n... (truncated)"
              : content}
          </pre>
        )}
      </div>

      {lightboxOpen && (isImage || isImageFile) && (
        <ImageLightbox
          src={imageSrc}
          alt={selectedFile.name}
          onClose={closeLightbox}
        />
      )}
    </div>
  );
}
