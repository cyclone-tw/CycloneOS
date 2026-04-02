"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Loader2, Send, Download, FileText, FileSpreadsheet, Wrench } from "lucide-react";
import { useFeloOutputStore } from "@/stores/felo-output-store";
import { FeloShortcuts } from "./felo-shortcuts";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolResults?: Array<{
    toolName: string;
    title?: string;
    localPaths?: string[];
  }>;
}

export function FeloChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const isComposingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { addOutput, setLiveDocId, liveDocId } = useFeloOutputStore();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleShortcut = (prompt: string) => {
    setInput(prompt);
  };

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);

    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", toolResults: [] },
    ]);

    try {
      const res = await fetch("/api/felo/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: text.trim(),
          threadId,
          liveDocId,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `❌ ${err.error || "Error"}` }
              : m,
          ),
        );
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const lines = part.split("\n");
          let eventType = "";
          let dataLine = "";

          for (const line of lines) {
            if (line.startsWith("event: ")) eventType = line.slice(7).trim();
            else if (line.startsWith("data: ")) dataLine = line.slice(6).trim();
          }

          if (!dataLine) continue;

          try {
            const parsed = JSON.parse(dataLine);

            if (eventType === "state") {
              if (parsed.threadId) setThreadId(parsed.threadId);
              if (parsed.liveDocId) setLiveDocId(parsed.liveDocId);
            } else if (eventType === "status") {
              setCurrentStatus(parsed.text || null);
            } else if (eventType === "message") {
              setCurrentStatus(null);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + (parsed.content || "") }
                    : m,
                ),
              );
            } else if (eventType === "tool-result") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        toolResults: [...(m.toolResults || []), parsed],
                      }
                    : m,
                ),
              );

              if (parsed.toolName === "generate_images" && parsed.localPaths) {
                for (const lp of parsed.localPaths) {
                  addOutput({
                    id: crypto.randomUUID(),
                    type: "image",
                    localPath: lp,
                    prompt: text.trim(),
                    createdAt: new Date().toISOString(),
                  });
                }
              }
            }
          } catch {
            // skip
          }
        }
      }
    } catch (e) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: `❌ ${e instanceof Error ? e.message : "Error"}` }
            : m,
        ),
      );
    } finally {
      setIsStreaming(false);
      setCurrentStatus(null);
    }
  }, [isStreaming, threadId, liveDocId, addOutput, setLiveDocId]);

  // Export message content
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [customInstructionId, setCustomInstructionId] = useState<string | null>(null);
  const [customInstruction, setCustomInstruction] = useState("");

  const handleExport = useCallback(async (msgId: string, format: "md" | "docx" | "xlsx", instruction?: string) => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg || !msg.content.trim()) return;

    setExportingId(msgId);
    setMenuOpenId(null);
    setCustomInstructionId(null);

    try {
      const res = await fetch("/api/felo/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: msg.content,
          format,
          instruction: instruction || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Export failed" }));
        alert(`匯出失敗：${err.error}`);
        return;
      }

      const data = await res.json();

      // Add to output store
      addOutput({
        id: crypto.randomUUID(),
        type: "document",
        localPath: data.path,
        prompt: instruction || `匯出為 ${format.toUpperCase()}`,
        createdAt: new Date().toISOString(),
      });

      // Show success in chat
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `✅ 已匯出：${data.fileName}\n📁 ${data.path}`,
        },
      ]);
    } catch (e) {
      alert(`匯出錯誤：${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setExportingId(null);
    }
  }, [messages, addOutput]);

  return (
    <div className="flex h-full flex-col">
      <FeloShortcuts onSelect={handleShortcut} />

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <p className="py-16 text-center text-sm text-cy-muted/50">
            開始跟 Felo SuperAgent 對話
          </p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[85%]">
              <div
                className={`rounded-lg px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-cy-accent/15 text-cy-text"
                    : "bg-cy-input/30 text-cy-text"
                }`}
              >
                {msg.role === "user" ? (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <div className="prose-cy">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeHighlight]}
                      components={{
                        p: ({ children }) => <p className="mb-1.5 last:mb-0 text-cy-text/90">{children}</p>,
                        strong: ({ children }) => <strong className="font-semibold text-cy-text">{children}</strong>,
                        em: ({ children }) => <em className="text-cy-text/80">{children}</em>,
                        h1: ({ children }) => <h1 className="mb-2 mt-3 text-base font-bold text-cy-text">{children}</h1>,
                        h2: ({ children }) => <h2 className="mb-1.5 mt-2 text-sm font-semibold text-cy-text">{children}</h2>,
                        h3: ({ children }) => <h3 className="mb-1 mt-1.5 text-sm font-semibold text-cy-text">{children}</h3>,
                        ul: ({ children }) => <ul className="mb-1.5 ml-4 list-disc space-y-0.5 text-cy-text/90">{children}</ul>,
                        ol: ({ children }) => <ol className="mb-1.5 ml-4 list-decimal space-y-0.5 text-cy-text/90">{children}</ol>,
                        li: ({ children }) => <li className="text-cy-text/90">{children}</li>,
                        a: ({ href, children }) => (
                          <a href={href} target="_blank" rel="noopener noreferrer" className="text-purple-400 underline underline-offset-2 hover:text-purple-300">
                            {children}
                          </a>
                        ),
                        pre: ({ children }) => (
                          <pre className="my-1.5 overflow-x-auto rounded-md bg-cy-bg/60 p-2 text-xs">
                            {children}
                          </pre>
                        ),
                        code: ({ className, children, ...props }) => {
                          const isBlock = className?.includes("language-") || className?.includes("hljs");
                          if (isBlock) {
                            return <code className={className} {...props}>{children}</code>;
                          }
                          return (
                            <code className="rounded bg-cy-input/40 px-1 py-0.5 text-xs text-purple-300" {...props}>
                              {children}
                            </code>
                          );
                        },
                        blockquote: ({ children }) => (
                          <blockquote className="my-1.5 border-l-2 border-purple-500/40 pl-2.5 text-cy-text/80 italic">
                            {children}
                          </blockquote>
                        ),
                        table: ({ children }) => (
                          <div className="my-1.5 overflow-x-auto rounded border border-cy-input/30">
                            <table className="w-full text-xs">{children}</table>
                          </div>
                        ),
                        th: ({ children }) => (
                          <th className="border-b border-cy-input/30 bg-cy-input/20 px-2 py-1 text-left font-medium text-cy-text">{children}</th>
                        ),
                        td: ({ children }) => (
                          <td className="border-b border-cy-input/10 px-2 py-1 text-cy-text/80">{children}</td>
                        ),
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                )}
                {msg.toolResults?.map((tr, i) => (
                  <div key={i} className="mt-2 rounded border border-purple-500/20 bg-purple-500/5 p-2 text-xs">
                    <p className="text-purple-300 font-medium">{tr.toolName}: {tr.title || "完成"}</p>
                    {tr.localPaths?.map((lp, j) => (
                      <img key={j} src={lp} alt="" className="mt-1 max-h-32 rounded" />
                    ))}
                  </div>
                ))}
              </div>

              {/* Export actions — only on assistant messages with content */}
              {msg.role === "assistant" && msg.content.trim() && !msg.content.startsWith("✅") && (
                <div className="mt-1 relative">
                  {exportingId === msg.id ? (
                    <span className="inline-flex items-center gap-1 text-[10px] text-cy-muted">
                      <Loader2 className="h-3 w-3 animate-spin" /> 匯出中...
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={() => setMenuOpenId(menuOpenId === msg.id ? null : msg.id)}
                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-cy-muted hover:text-cy-text hover:bg-cy-input/30 transition-colors"
                      >
                        <Download className="h-3 w-3" /> 匯出
                      </button>

                      {menuOpenId === msg.id && (
                        <div className="absolute left-0 bottom-6 z-10 rounded-lg border border-cy-border bg-cy-card shadow-xl p-1.5 space-y-0.5 min-w-[160px]">
                          <button
                            onClick={() => handleExport(msg.id, "md")}
                            className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs text-cy-text hover:bg-cy-input/40 transition-colors"
                          >
                            <FileText className="h-3.5 w-3.5" /> 存為 Markdown
                          </button>
                          <button
                            onClick={() => handleExport(msg.id, "docx")}
                            className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs text-cy-text hover:bg-cy-input/40 transition-colors"
                          >
                            <FileText className="h-3.5 w-3.5" /> 存為 DOCX
                          </button>
                          <button
                            onClick={() => handleExport(msg.id, "xlsx")}
                            className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs text-cy-text hover:bg-cy-input/40 transition-colors"
                          >
                            <FileSpreadsheet className="h-3.5 w-3.5" /> 存為 Excel
                          </button>
                          <div className="border-t border-cy-border/30 my-1" />
                          <button
                            onClick={() => {
                              setCustomInstructionId(msg.id);
                              setMenuOpenId(null);
                              setCustomInstruction("");
                            }}
                            className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs text-purple-300 hover:bg-purple-500/10 transition-colors"
                          >
                            <Wrench className="h-3.5 w-3.5" /> 自訂指令處理
                          </button>
                        </div>
                      )}

                      {customInstructionId === msg.id && (
                        <div className="mt-1.5 flex gap-1.5">
                          <input
                            value={customInstruction}
                            onChange={(e) => setCustomInstruction(e.target.value)}
                            onCompositionStart={() => { isComposingRef.current = true; }}
                            onCompositionEnd={() => { isComposingRef.current = false; }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !isComposingRef.current && customInstruction.trim()) {
                                e.preventDefault();
                                handleExport(msg.id, "md", customInstruction);
                              }
                              if (e.key === "Escape") setCustomInstructionId(null);
                            }}
                            placeholder="例：只取表格部分、翻譯成英文..."
                            autoFocus
                            className="flex-1 rounded border border-purple-500/30 bg-cy-input/50 px-2 py-1 text-xs text-cy-text placeholder:text-cy-muted/50 focus:outline-none focus:border-purple-500/50"
                          />
                          <button
                            onClick={() => handleExport(msg.id, "md", customInstruction)}
                            disabled={!customInstruction.trim()}
                            className="rounded bg-purple-600 px-2 py-1 text-xs text-white hover:bg-purple-500 disabled:opacity-50"
                          >
                            處理
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {currentStatus && (
          <div className="flex items-center gap-2 px-1">
            <Loader2 className="h-3 w-3 animate-spin text-cy-muted/60" />
            <span className="text-xs text-cy-muted/60">{currentStatus}</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-cy-border/30 p-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onCompositionStart={() => { isComposingRef.current = true; }}
            onCompositionEnd={() => { isComposingRef.current = false; }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !isComposingRef.current) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            placeholder="輸入訊息..."
            disabled={isStreaming}
            className="flex-1 rounded-lg border border-cy-border bg-cy-input/50 px-3 py-2 text-sm text-cy-text placeholder:text-cy-muted/50 focus:border-purple-500/50 focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isStreaming}
            className="rounded-lg bg-purple-600 px-3 py-2 text-white hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
