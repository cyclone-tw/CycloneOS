"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Send, Loader2 } from "lucide-react";
import { usePresentationsStore, type SlideOutline } from "@/stores/presentations-store";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function PresentationsChat() {
  const {
    getActiveSession,
    addChatMessage,
    setOutline,
    setClaudeSessionId,
    setError,
  } = usePresentationsStore();
  const session = getActiveSession();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messages = session?.chatHistory ?? [];
  const slides = session?.outline.slides ?? [];
  const hasOutline = slides.length > 0;

  const [input, setInput] = useState("");
  const [isRefining, setIsRefining] = useState(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    if (!session || !input.trim() || isRefining) return;

    const userMessage = input.trim();
    setInput("");
    setIsRefining(true);

    // Add user message to chat
    const targetSlideId = session.selectedSlideId ?? undefined;
    addChatMessage({
      role: "user",
      content: userMessage,
      targetSlideId,
    });

    try {
      const res = await fetch("/api/presentations/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outline: session.outline,
          message: userMessage,
          targetSlideId,
          claudeSessionId: session.claudeSessionId,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        addChatMessage({ role: "assistant", content: `錯誤：${err.error || `HTTP ${res.status}`}` });
        setIsRefining(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        addChatMessage({ role: "assistant", content: "錯誤：無回應串流" });
        setIsRefining(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let gotOutline = false;
      let gotAssistantMsg = false;

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
            if (eventType === "session") {
              const parsed = JSON.parse(dataLine);
              if (parsed.sessionId) setClaudeSessionId(parsed.sessionId);
            } else if (eventType === "outline") {
              const parsed = JSON.parse(dataLine);
              const outline = (parsed.outline ?? parsed) as SlideOutline;
              setOutline(outline);
              gotOutline = true;
            } else if (eventType === "assistant") {
              const parsed = JSON.parse(dataLine);
              addChatMessage({ role: "assistant", content: parsed.content });
              gotAssistantMsg = true;
            } else if (eventType === "error") {
              const parsed = JSON.parse(dataLine);
              setError(parsed.message || "Refinement failed");
            }
          } catch {
            // skip parse errors
          }
        }
      }

      if (gotOutline && !gotAssistantMsg) {
        addChatMessage({ role: "assistant", content: "已更新簡報大綱。" });
      }
    } catch (e) {
      addChatMessage({
        role: "assistant",
        content: `錯誤：${e instanceof Error ? e.message : "未知錯誤"}`,
      });
    } finally {
      setIsRefining(false);
      inputRef.current?.focus();
    }
  }, [session, input, isRefining, addChatMessage, setOutline, setClaudeSessionId, setError]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full flex-col border-t border-cy-border">
      <div className="flex items-center justify-between px-3 py-2">
        <h3 className="text-xs font-medium text-cy-muted">🤖 AI 對話</h3>
        <div className="flex items-center gap-2">
          {session?.selectedSlideId && hasOutline && (
            <span className="text-[11px] text-cy-accent/60">
              針對第 {(slides.findIndex((s) => s.id === session.selectedSlideId) ?? -1) + 1} 頁
            </span>
          )}
          {session?.claudeSessionId && (
            <span className="text-[11px] text-cy-muted/40">session 已建立 · sonnet</span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 space-y-2">
        {messages.length === 0 && (
          <p className="py-4 text-center text-xs text-cy-muted/60">
            {hasOutline
              ? "在下方輸入指示來修改投影片內容，例如「把第 3 頁改成 dataviz」"
              : "生成大綱後，可在此精煉投影片內容"}
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-lg px-3 py-2 text-sm ${
              msg.role === "user"
                ? "ml-8 bg-cy-accent/15 text-cy-text"
                : "mr-4 bg-cy-input/50 text-cy-text"
            }`}
          >
            {msg.targetSlideId && (
              <div className="mb-1 text-[11px] text-cy-muted/60">
                針對第 {(slides.findIndex((s) => s.id === msg.targetSlideId) ?? -1) + 1} 頁
              </div>
            )}
            {msg.role === "assistant" ? (
              <div className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-headings:my-1.5 prose-ul:my-1 prose-li:my-0">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.content}
                </ReactMarkdown>
              </div>
            ) : (
              msg.content
            )}
          </div>
        ))}
        {isRefining && (
          <div className="flex items-center gap-2 mr-4 rounded-lg bg-cy-input/50 px-3 py-2 text-sm text-cy-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            修改中...
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 border-t border-cy-border p-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!hasOutline || isRefining}
          placeholder={hasOutline ? "輸入修改指示，例：加一頁數據分析" : "請先生成大綱"}
          className="flex-1 rounded-md bg-cy-input/50 px-2.5 py-1.5 text-sm text-cy-text placeholder:text-cy-muted/50 outline-none disabled:opacity-40 focus:ring-1 focus:ring-cy-accent/30"
        />
        <button
          onClick={handleSend}
          disabled={!hasOutline || isRefining || !input.trim()}
          className="rounded-md p-1.5 text-cy-accent transition-colors hover:bg-cy-accent/10 disabled:opacity-30"
        >
          {isRefining ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
