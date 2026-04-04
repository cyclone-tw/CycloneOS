"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";
import { useDocumentsStore, type DocChatMessage } from "@/stores/documents-store";
import { useAgentStore } from "@/stores/agent-store";
import { cleanClaudeOutput } from "@/lib/documents-utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function DocumentsChat() {
  const {
    currentSession,
    addChatMessage,
    setOutputContent,
    setError,
    setClaudeSessionId,
  } = useDocumentsStore();
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { provider, model } = useAgentStore();
  const messages = currentSession?.chatHistory ?? [];
  const hasSources = (currentSession?.sources.length ?? 0) > 0;
  const hasOutput = !!currentSession?.outputContent;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, streamingContent]);

  const handleSend = async () => {
    if (!input.trim() || isSending || !hasSources || !currentSession) return;

    const userMsg: DocChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      timestamp: Date.now(),
    };
    addChatMessage(userMsg);
    const userContent = input.trim();
    setInput("");
    setIsSending(true);
    setStreamingContent("");

    // Build task description based on context
    let taskDescription: string;
    const resumeSessionId =
      currentSession.sessionProvider === provider ? currentSession.claudeSessionId : null;
    const isResume = !!resumeSessionId;

    if (isResume) {
      // Resuming — just send the user's message
      taskDescription = userContent;
    } else if (hasOutput) {
      taskDescription = [
        "以下是目前產出的文件內容：",
        "",
        currentSession.outputContent,
        "",
        `使用者的指令：${userContent}`,
        "",
        "如果使用者要求修改文件，請直接輸出完整的修改後 Markdown 內容（不要加前言）。",
        "如果使用者只是在問問題，請正常回答。",
      ].join("\n");
    } else {
      taskDescription = [
        `使用者的問題：${userContent}`,
        "",
        "請根據來源資料回答使用者的問題。用繁體中文回答，簡潔扼要。",
      ].join("\n");
    }

    try {
      const res = await fetch("/api/documents/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sources: currentSession.sources,
          taskDescription,
          outputFormats: [],   // don't save file for chat
          outputPath: "",
          claudeSessionId: resumeSessionId,
          provider,
          model,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: "Request failed" }));
        setError(errBody.error || `HTTP ${res.status}`);
        setIsSending(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) { setIsSending(false); return; }

      let fullResponse = "";
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "text") {
              fullResponse += event.content;
              setStreamingContent(fullResponse);
            } else if (event.type === "session" && event.sessionId) {
              setClaudeSessionId(event.sessionId, provider);
            } else if (event.type === "error") {
              setError(event.content);
            }
          } catch { /* skip */ }
        }
      }

      if (fullResponse) {
        const cleaned = cleanClaudeOutput(fullResponse);

        // Detect if response is a full document update vs conversational answer
        const looksLikeDocument =
          hasOutput &&
          (cleaned.startsWith("# ") ||
            cleaned.startsWith("## ") ||
            cleaned.split("\n").length > 20);

        if (looksLikeDocument) {
          setOutputContent(cleaned);
          addChatMessage({
            id: crypto.randomUUID(),
            role: "assistant",
            content: "已根據你的指令更新文件預覽。",
            timestamp: Date.now(),
          });
        } else {
          addChatMessage({
            id: crypto.randomUUID(),
            role: "assistant",
            content: cleaned,
            timestamp: Date.now(),
          });
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat error");
    } finally {
      setIsSending(false);
      setStreamingContent("");
    }
  };

  const placeholder = !hasSources
    ? "請先選擇來源檔案"
    : hasOutput
      ? "輸入指令微調文件，或問問題..."
      : "問 AI 關於這些檔案的問題...";

  const emptyHint = !hasSources
    ? "選擇來源檔案後，可以先和 AI 對話瞭解內容"
    : "選好檔案了！你可以先問 AI 「這些檔案有什麼內容？」";

  return (
    <div className="flex h-full flex-col border-t border-cy-border">
      <div className="flex items-center justify-between px-3 py-2">
        <h3 className="text-xs font-medium text-cy-muted">🤖 AI 對話</h3>
        {currentSession?.claudeSessionId && (
          <span className="text-[11px] text-cy-muted/40">session 已建立 · {provider} · {model}</span>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 space-y-2">
        {messages.length === 0 && !streamingContent && (
          <p className="py-4 text-center text-xs text-cy-muted/60">
            {emptyHint}
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
        {/* Streaming indicator */}
        {streamingContent && (
          <div className="mr-4 rounded-lg bg-cy-input/50 px-3 py-2 text-sm text-cy-text">
            <div className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-headings:my-1.5 prose-ul:my-1 prose-li:my-0">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {streamingContent}
              </ReactMarkdown>
            </div>
          </div>
        )}
        {isSending && !streamingContent && (
          <div className="flex items-center gap-2 py-2 text-xs text-cy-accent">
            <Loader2 className="h-3 w-3 animate-spin" />
            AI 思考中...
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 border-t border-cy-border p-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && handleSend()}
          placeholder={placeholder}
          disabled={!hasSources || isSending}
          className="flex-1 rounded-md bg-cy-input/50 px-2.5 py-1.5 text-sm text-cy-text placeholder:text-cy-muted/50 outline-none disabled:opacity-40"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || !hasSources || isSending}
          className="rounded-md p-1.5 text-cy-accent transition-colors hover:bg-cy-accent/10 disabled:opacity-30"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
