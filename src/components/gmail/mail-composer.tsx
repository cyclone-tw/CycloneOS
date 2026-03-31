"use client";

import { useState } from "react";
import { useGmailStore } from "@/stores/gmail-store";
import { Sparkles, Send, Loader2, Check, X, ChevronDown, ChevronUp } from "lucide-react";

export function MailComposer() {
  const { selectedThread, getCachedClassify, setCachedClassify } = useGmailStore();
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  async function handleAiDraft() {
    if (!selectedThread || selectedThread.messages.length === 0) return;
    setIsGenerating(true);
    setError(null);

    try {
      const lastMsg = selectedThread.messages[selectedThread.messages.length - 1];

      // Check cache first (must be a withReply entry)
      const cached = getCachedClassify(selectedThread.id, true);
      let data = cached;

      if (!data) {
        const res = await fetch("/api/gmail/classify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threadId: selectedThread.id,
            generateReply: true,
          }),
        });
        data = await res.json();
        if (data && !("error" in data)) {
          setCachedClassify(selectedThread.id, data, true);
        }
      }

      // Pre-fill fields from thread
      const fromEmail = lastMsg.from.match(/<([^>]+)>/)?.[1] || lastMsg.from;
      setTo(fromEmail);
      setSubject(
        lastMsg.subject.startsWith("Re:") ? lastMsg.subject : `Re: ${lastMsg.subject}`
      );

      if (data?.draft) {
        setBody(data.draft);
      } else {
        setBody("");
      }
    } catch {
      setError("AI 草稿生成失敗");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSendDraft() {
    if (!to || !subject || !body) return;
    setIsSending(true);
    setError(null);

    try {
      const res = await fetch("/api/gmail/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          subject,
          content: body,
          threadId: selectedThread?.id,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSent(true);
      setTimeout(() => setSent(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "儲存草稿失敗");
    } finally {
      setIsSending(false);
    }
  }

  function handleClear() {
    setTo("");
    setSubject("");
    setBody("");
    setError(null);
    setSent(false);
  }

  return (
    <div>
      {/* Collapsible header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded px-1 py-1 text-xs transition-colors hover:bg-cy-input/20"
      >
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-cy-text">草稿</span>
          {(to || subject || body) && (
            <span className="rounded-full bg-cy-accent/20 px-1.5 py-0.5 text-[9px] text-cy-accent">
              編輯中
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {selectedThread && !isOpen && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(true);
                handleAiDraft();
              }}
              className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-cy-accent transition-colors hover:bg-cy-accent/10"
            >
              <Sparkles className="h-3 w-3" />
              AI 回覆
            </span>
          )}
          {isOpen ? (
            <ChevronUp className="h-3.5 w-3.5 text-cy-muted" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-cy-muted" />
          )}
        </div>
      </button>

      {/* Collapsible body */}
      {isOpen && (
        <div className="mt-2 space-y-2">
          <div className="flex items-center justify-end gap-1">
            {selectedThread && (
              <button
                onClick={handleAiDraft}
                disabled={isGenerating}
                className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-cy-accent transition-colors hover:bg-cy-accent/10 disabled:opacity-50"
              >
                {isGenerating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                AI 回覆
              </button>
            )}
            {(to || subject || body) && (
              <button
                onClick={handleClear}
                className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-cy-muted transition-colors hover:bg-cy-input/40"
              >
                <X className="h-3 w-3" />
                清除
              </button>
            )}
          </div>

          <input
            type="text"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="收件者"
            className="w-full rounded border border-cy-input/40 bg-cy-card px-2.5 py-1 text-xs text-cy-text placeholder:text-cy-muted focus:border-cy-accent focus:outline-none"
          />
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="主旨"
            className="w-full rounded border border-cy-input/40 bg-cy-card px-2.5 py-1 text-xs text-cy-text placeholder:text-cy-muted focus:border-cy-accent focus:outline-none"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="內容..."
            rows={5}
            className="w-full resize-none rounded border border-cy-input/40 bg-cy-card px-2.5 py-1.5 text-xs text-cy-text placeholder:text-cy-muted focus:border-cy-accent focus:outline-none"
          />

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          <button
            onClick={handleSendDraft}
            disabled={!to || !subject || !body || isSending}
            className="flex w-full items-center justify-center gap-1.5 rounded-md bg-cy-accent/15 px-3 py-1.5 text-xs font-medium text-cy-accent transition-colors hover:bg-cy-accent/25 disabled:opacity-40"
          >
            {sent ? (
              <>
                <Check className="h-3.5 w-3.5" />
                已儲存草稿
              </>
            ) : isSending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                儲存為草稿
              </>
            )}
          </button>

          <p className="text-center text-xs text-cy-muted">
            草稿會存到 Gmail，需到 Gmail 發送
          </p>
        </div>
      )}
    </div>
  );
}
