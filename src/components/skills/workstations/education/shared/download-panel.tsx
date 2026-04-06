"use client";

import { Download, FileText, Check, Loader2 } from "lucide-react";

interface DownloadResult {
  docxUrl?: string;
  docxFilename?: string;
  mdPath?: string;
  mocUpdated?: boolean;
  htmlUrl?: string;
}

interface DownloadPanelProps {
  result: DownloadResult | null;
  loading?: boolean;
  onGenerate: () => void;
  generateLabel?: string;
}

export function DownloadPanel({ result, loading, onGenerate, generateLabel }: DownloadPanelProps) {
  if (!result) {
    return (
      <button
        onClick={onGenerate}
        disabled={loading}
        className="flex items-center gap-2 rounded-lg bg-cy-accent px-4 py-2 text-sm font-medium text-white hover:bg-cy-accent/90 disabled:opacity-50 transition-colors"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
        {loading ? "生成中..." : (generateLabel ?? "生成文件")}
      </button>
    );
  }

  return (
    <div className="space-y-2">
      {result.docxUrl && (
        <a
          href={result.docxUrl}
          download={result.docxFilename}
          className="flex items-center gap-2 rounded-lg border border-cy-accent bg-cy-accent/10 px-4 py-2 text-sm text-cy-accent hover:bg-cy-accent/20 transition-colors"
        >
          <Download className="h-4 w-4" />
          下載 .docx
          {result.docxFilename && (
            <span className="ml-auto text-xs text-cy-muted">{result.docxFilename}</span>
          )}
        </a>
      )}
      {result.mdPath && (
        <div className="flex items-center gap-2 text-xs text-cy-muted">
          <Check className="h-3.5 w-3.5 text-green-500" />
          .md 已存：{result.mdPath}
        </div>
      )}
      {result.mocUpdated && (
        <div className="flex items-center gap-2 text-xs text-cy-muted">
          <Check className="h-3.5 w-3.5 text-green-500" />
          MOC 已更新
        </div>
      )}
      {result.htmlUrl && (
        <a
          href={result.htmlUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-xs text-cy-accent hover:text-cy-accent/80"
        >
          <Check className="h-3.5 w-3.5 text-green-500" />
          GitHub Pages：{result.htmlUrl}
        </a>
      )}
    </div>
  );
}
