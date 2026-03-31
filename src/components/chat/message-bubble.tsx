"use client";

import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import type { ChatMessage } from "@/types/chat";
import { cn } from "@/lib/utils";
import { Check, Copy } from "lucide-react";

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-cy-muted transition-colors hover:bg-cy-input/40 hover:text-cy-text"
      title="複製程式碼"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 text-cy-success" />
          <span className="text-cy-success">Copied</span>
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          <span>Copy</span>
        </>
      )}
    </button>
  );
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3 px-4", isUser ? "justify-end" : "justify-start")}>
      {/* Assistant avatar */}
      {!isUser && (
        <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cy-accent to-cy-accent/60 text-xs font-bold text-cy-bg">
          C
        </div>
      )}

      <div
        className={cn(
          "max-w-[85%] min-w-0",
          isUser
            ? "rounded-2xl rounded-br-md bg-cy-accent/15 px-4 py-2.5"
            : "py-1"
        )}
      >
        {/* User file attachments */}
        {isUser && message.files && message.files.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {message.files.map((file, i) =>
              file.previewUrl ? (
                <img
                  key={i}
                  src={file.previewUrl}
                  alt={file.name}
                  className="max-h-48 rounded-lg border border-cy-input/30 object-contain"
                />
              ) : (
                <div
                  key={i}
                  className="flex items-center gap-1.5 rounded-lg border border-cy-input/30 bg-cy-bg/40 px-2 py-1 text-xs text-cy-text/85"
                >
                  <span className="opacity-60">📎</span>
                  <span className="max-w-[140px] truncate">{file.name}</span>
                </div>
              )
            )}
          </div>
        )}

        {/* Message content */}
        {isUser ? (
          <div className="text-sm leading-relaxed text-cy-text whitespace-pre-wrap">
            {message.content}
          </div>
        ) : (
          <div className="prose-cy text-sm leading-relaxed">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0 text-cy-text/90">{children}</p>,
                strong: ({ children }) => <strong className="font-semibold text-cy-text">{children}</strong>,
                em: ({ children }) => <em className="text-cy-text/80">{children}</em>,
                h1: ({ children }) => <h1 className="mb-2 mt-4 text-lg font-bold text-cy-text">{children}</h1>,
                h2: ({ children }) => <h2 className="mb-2 mt-3 text-base font-semibold text-cy-text">{children}</h2>,
                h3: ({ children }) => <h3 className="mb-1 mt-2 text-sm font-semibold text-cy-text">{children}</h3>,
                ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-0.5 text-cy-text/90">{children}</ul>,
                ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-0.5 text-cy-text/90">{children}</ol>,
                li: ({ children }) => <li className="text-cy-text/90">{children}</li>,
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-cy-accent underline underline-offset-2 hover:text-cy-accent/80">
                    {children}
                  </a>
                ),
                pre: ({ children }) => {
                  // Extract text content from code element for copy button
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const extractText = (node: any): string => {
                    if (typeof node === "string") return node;
                    if (Array.isArray(node)) return node.map(extractText).join("");
                    if (node?.props?.children) return extractText(node.props.children);
                    return "";
                  };
                  const codeText = extractText(children);

                  // Extract language from code child's className
                  let lang = "";
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const childProps = (children as any)?.props;
                  if (childProps?.className) {
                    const match = childProps.className.match(/language-(\S+)/);
                    if (match) lang = match[1];
                  }

                  return (
                    <div className="my-2 overflow-hidden rounded-lg border border-cy-input/30">
                      <div className="flex items-center justify-between border-b border-cy-input/30 bg-cy-input/20 px-3 py-1">
                        <span className="text-xs text-cy-muted">{lang || "code"}</span>
                        <CopyButton text={codeText} />
                      </div>
                      <pre className="overflow-x-auto bg-cy-bg/60 p-3 !m-0">
                        {children}
                      </pre>
                    </div>
                  );
                },
                code: ({ className, children, ...props }) => {
                  const isBlock = className?.includes("language-") || className?.includes("hljs");
                  if (isBlock) {
                    return (
                      <code className={cn("text-[13px] leading-relaxed", className)} {...props}>
                        {children}
                      </code>
                    );
                  }
                  return (
                    <code className="rounded bg-cy-input/40 px-1.5 py-0.5 text-[13px] text-cy-accent/90" {...props}>
                      {children}
                    </code>
                  );
                },
                blockquote: ({ children }) => (
                  <blockquote className="my-2 border-l-2 border-cy-accent/40 pl-3 text-cy-text/85 italic">
                    {children}
                  </blockquote>
                ),
                table: ({ children }) => (
                  <div className="my-2 overflow-x-auto rounded-lg border border-cy-input/30">
                    <table className="w-full text-xs">{children}</table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="border-b border-cy-input/30 bg-cy-input/20 px-3 py-1.5 text-left font-medium text-cy-text">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="border-b border-cy-input/10 px-3 py-1.5 text-cy-text/80">
                    {children}
                  </td>
                ),
                hr: () => <hr className="my-3 border-cy-input/30" />,
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {/* Timestamp */}
        <div className={cn(
          "mt-1 text-xs text-cy-muted/75",
          isUser ? "text-right" : "text-left"
        )}>
          {formatTime(message.timestamp)}
        </div>
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cy-input/60 text-xs font-medium text-cy-muted">
          U
        </div>
      )}
    </div>
  );
}
