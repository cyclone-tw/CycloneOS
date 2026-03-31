"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Loader2, Send } from "lucide-react";
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
            } else if (eventType === "message") {
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
    }
  }, [isStreaming, threadId, liveDocId, addOutput, setLiveDocId]);

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
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-cy-accent/15 text-cy-text"
                  : "bg-cy-input/30 text-cy-text"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.toolResults?.map((tr, i) => (
                <div key={i} className="mt-2 rounded border border-purple-500/20 bg-purple-500/5 p-2 text-xs">
                  <p className="text-purple-300 font-medium">{tr.toolName}: {tr.title || "完成"}</p>
                  {tr.localPaths?.map((lp, j) => (
                    <img key={j} src={lp} alt="" className="mt-1 max-h-32 rounded" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-cy-border/30 p-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
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
