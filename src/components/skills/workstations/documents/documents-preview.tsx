"use client";

import { FileText } from "lucide-react";
import { useDocumentsStore } from "@/stores/documents-store";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

export function DocumentsPreview() {
  const { currentSession, isProcessing } = useDocumentsStore();
  const content = currentSession?.outputContent ?? "";

  if (!content && !isProcessing) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-cy-muted">
        <FileText className="h-10 w-10 opacity-30" />
        <p className="text-sm">選好來源後按「開始處理」，或直接和 AI 對話</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      {isProcessing && !content && (
        <div className="flex items-center gap-2 text-sm text-cy-accent">
          <div className="h-2 w-2 animate-pulse rounded-full bg-cy-accent" />
          AI 正在處理...
        </div>
      )}
      {content && (
        <article className="prose prose-invert prose-sm max-w-none prose-headings:text-cy-text prose-p:text-cy-text prose-a:text-cy-accent prose-strong:text-cy-text prose-code:text-cy-accent/80 prose-pre:bg-cy-input/50 prose-pre:border prose-pre:border-cy-border">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
            {content}
          </ReactMarkdown>
        </article>
      )}
    </div>
  );
}
