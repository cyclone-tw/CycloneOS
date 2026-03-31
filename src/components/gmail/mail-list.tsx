"use client";

import { useGmailStore } from "@/stores/gmail-store";
import { cn } from "@/lib/utils";
import { Mail, MailOpen } from "lucide-react";
import type { GmailMessage } from "@/lib/gmail-client";

function formatSender(from: string): string {
  // "Name <email>" → "Name", or just return the email
  const match = from.match(/^"?([^"<]+)"?\s*</);
  return match ? match[1].trim() : from.split("@")[0];
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("zh-TW", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function MailItem({ message, isSelected }: { message: GmailMessage; isSelected: boolean }) {
  const { setSelectedMessageId, setSelectedThread, setIsThreadLoading, markAsRead } = useGmailStore();

  async function handleClick() {
    setSelectedMessageId(message.id);
    setIsThreadLoading(true);
    try {
      const res = await fetch(`/api/gmail/thread?threadId=${message.threadId}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSelectedThread(data);
      // Auto mark as read
      if (message.isUnread) {
        fetch("/api/gmail/mark-read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageIds: [message.id] }),
        }).catch(() => {});
        markAsRead([message.id]);
      }
    } catch {
      setSelectedThread(null);
    } finally {
      setIsThreadLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        "flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors",
        isSelected
          ? "bg-cy-accent/15 text-cy-text"
          : "text-cy-text hover:bg-cy-input/40"
      )}
    >
      <div className="mt-0.5 flex-shrink-0">
        {message.isUnread ? (
          <Mail className="h-4 w-4 text-cy-accent" />
        ) : (
          <MailOpen className="h-4 w-4 text-cy-muted" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "truncate text-xs",
              message.isUnread ? "font-semibold" : "font-normal text-cy-muted"
            )}
          >
            {formatSender(message.from)}
          </span>
          <span className="flex-shrink-0 text-xs text-cy-muted">
            {formatDate(message.date)}
          </span>
        </div>
        <div
          className={cn(
            "truncate text-xs",
            message.isUnread ? "font-medium" : "text-cy-muted"
          )}
        >
          {message.subject || "(無主旨)"}
        </div>
        <div className="mt-0.5 truncate text-xs text-cy-muted/70">
          {message.snippet}
        </div>
      </div>
    </button>
  );
}

export function MailList() {
  const { messages, selectedMessageId, isLoading, error, nextPageToken } =
    useGmailStore();

  if (isLoading && messages.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-cy-muted">
        載入中...
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-3 py-4 text-xs text-red-400">{error}</div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-sm text-cy-muted">
        沒有郵件
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {messages.map((msg) => (
        <MailItem
          key={msg.id}
          message={msg}
          isSelected={selectedMessageId === msg.id}
        />
      ))}
      {nextPageToken && (
        <LoadMoreButton />
      )}
    </div>
  );
}

function LoadMoreButton() {
  const { searchQuery, nextPageToken, appendMessages, setIsLoading } =
    useGmailStore();

  async function loadMore() {
    setIsLoading(true);
    try {
      const q = searchQuery.trim() || "is:unread";
      const res = await fetch(
        `/api/gmail/messages?q=${encodeURIComponent(q)}&pageToken=${nextPageToken}`
      );
      const data = await res.json();
      if (!data.error) {
        appendMessages(data.messages, data.nextPageToken);
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <button
      onClick={loadMore}
      className="mx-auto my-2 rounded-md px-3 py-1.5 text-xs text-cy-accent hover:bg-cy-accent/10 transition-colors"
    >
      載入更多
    </button>
  );
}
