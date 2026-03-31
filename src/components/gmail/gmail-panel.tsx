"use client";

import { useEffect, useCallback, useState } from "react";
import { useGmailStore } from "@/stores/gmail-store";
import { MailList } from "./mail-list";
import { MailDetail } from "./mail-detail";
import { Search, Inbox, AlertTriangle, RefreshCw, MailCheck, Archive } from "lucide-react";

const QUICK_FILTERS = [
  { label: "收件匣", query: "in:inbox" },
  { label: "未讀", query: "is:unread in:inbox" },
  { label: "需回覆", query: "is:unread -category:promotions -category:social -category:updates -from:noreply -from:no-reply" },
  { label: "所有郵件", query: "-in:trash -in:spam" },
  { label: "帳單", query: "subject:(帳單 OR 消費通知 OR 信用卡 OR 扣款 OR invoice OR 交易 OR 刷卡) OR from:(bank OR 銀行 OR coupang OR shopee OR 蝦皮)" },
  { label: "重要", query: "is:important" },
  { label: "星號", query: "is:starred" },
  { label: "推廣", query: "category:promotions" },
] as const;

export function GmailPanel() {
  const {
    messages,
    searchQuery,
    setSearchQuery,
    setMessages,
    setIsLoading,
    setError,
    setNextPageToken,
    selectedThread,
    markAsRead,
  } = useGmailStore();

  const [configured, setConfigured] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>(QUICK_FILTERS[0].query);

  const fetchMessages = useCallback(
    async (query: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/gmail/messages?q=${encodeURIComponent(query)}&maxResults=20`
        );
        const data = await res.json();
        if (data.configured === false) {
          setConfigured(false);
          setMessages([]);
          return;
        }
        if (data.error) {
          setError(data.error);
          setMessages([]);
          return;
        }
        setMessages(data.messages);
        setNextPageToken(data.nextPageToken);
      } catch (err) {
        setError("無法連線到 Gmail API");
        setMessages([]);
      } finally {
        setIsLoading(false);
      }
    },
    [setIsLoading, setError, setMessages, setNextPageToken]
  );

  // Initial load
  useEffect(() => {
    fetchMessages(activeFilter);
  }, [activeFilter, fetchMessages]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim() || activeFilter;
    fetchMessages(q);
  }

  function handleFilterClick(query: string) {
    setActiveFilter(query);
    setSearchQuery("");
  }

  async function handleMarkAllRead() {
    const unreadIds = messages.filter((m) => m.isUnread).map((m) => m.id);
    if (unreadIds.length === 0) return;
    markAsRead(unreadIds);
    try {
      await fetch("/api/gmail/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageIds: unreadIds }),
      });
    } catch {
      // silently fail — local state already updated
    }
  }

  // System labels that don't count as "user labels"
  const SYSTEM_LABELS = new Set([
    "INBOX", "UNREAD", "IMPORTANT", "SENT", "DRAFT", "SPAM", "TRASH",
    "STARRED", "CATEGORY_PERSONAL", "CATEGORY_SOCIAL", "CATEGORY_PROMOTIONS",
    "CATEGORY_UPDATES", "CATEGORY_FORUMS",
  ]);

  const [archiveCount, setArchiveCount] = useState(0);
  const [isArchiving, setIsArchiving] = useState(false);

  async function handleArchiveLabeled() {
    // Only archive messages that have at least one user label
    const labeledMsgs = messages.filter((m) =>
      m.labels.some((l) => !SYSTEM_LABELS.has(l))
    );
    if (labeledMsgs.length === 0) return;

    const ids = labeledMsgs.map((m) => m.id);
    setIsArchiving(true);
    try {
      const res = await fetch("/api/gmail/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageIds: ids }),
      });
      const data = await res.json();
      if (data.success) {
        setArchiveCount(ids.length);
        // Remove archived messages from local list
        setMessages(messages.filter((m) => !ids.includes(m.id)));
        setTimeout(() => setArchiveCount(0), 3000);
      }
    } catch {
      // silently fail
    } finally {
      setIsArchiving(false);
    }
  }

  if (!configured) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-cy-muted">
        <AlertTriangle className="h-8 w-8 text-yellow-500/60" />
        <div className="text-center text-sm">
          <p className="font-medium text-cy-text">Gmail 尚未設定</p>
          <p className="mt-1 text-xs">
            請在 <code className="rounded bg-cy-input/30 px-1">.env.local</code> 設定：
          </p>
          <pre className="mt-2 rounded bg-cy-bg/80 p-2 text-left text-xs">
{`GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...`}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-cy-text">Gmail</h1>
        <div className="flex items-center gap-1">
          <button
            onClick={handleMarkAllRead}
            className="rounded p-1.5 text-cy-muted transition-colors hover:bg-cy-input/40 hover:text-cy-text"
            title="全部標為已讀"
          >
            <MailCheck className="h-4 w-4" />
          </button>
          <button
            onClick={handleArchiveLabeled}
            disabled={isArchiving}
            className="rounded p-1.5 text-cy-muted transition-colors hover:bg-cy-input/40 hover:text-cy-text disabled:opacity-50"
            title="封存有標籤的信件"
          >
            <Archive className="h-4 w-4" />
          </button>
          <button
            onClick={() => fetchMessages(searchQuery.trim() || activeFilter)}
            className="rounded p-1.5 text-cy-muted transition-colors hover:bg-cy-input/40 hover:text-cy-text"
            title="重新整理"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-cy-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜尋郵件（支援 Gmail 搜尋語法）"
            className="w-full rounded-md border border-cy-input/50 bg-cy-card py-1.5 pl-8 pr-3 text-xs text-cy-text placeholder:text-cy-muted focus:border-cy-accent focus:outline-none"
          />
        </div>
      </form>

      {archiveCount > 0 && (
        <div className="rounded-md bg-green-500/10 px-2.5 py-1 text-xs text-green-400">
          已封存 {archiveCount} 封有標籤的信件
        </div>
      )}

      {/* Quick filters */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_FILTERS.map((f) => (
          <button
            key={f.query}
            onClick={() => handleFilterClick(f.query)}
            className={`rounded-full px-2.5 py-0.5 text-xs transition-colors ${
              activeFilter === f.query && !searchQuery.trim()
                ? "bg-cy-accent/20 text-cy-accent"
                : "bg-cy-input/30 text-cy-muted hover:bg-cy-input/50 hover:text-cy-text"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Content: list + detail */}
      <div className="flex min-h-0 flex-1 gap-3">
        {/* Mail list */}
        <div className="cy-glass w-2/5 overflow-auto rounded-lg p-1.5">
          <MailList />
        </div>

        {/* Mail detail */}
        <div className="cy-glass flex-1 overflow-auto rounded-lg p-3">
          <MailDetail />
        </div>
      </div>
    </div>
  );
}
