"use client";

import { useMemo } from "react";
import DOMPurify from "dompurify";
import { useGmailStore } from "@/stores/gmail-store";
import { LabelManager } from "./label-manager";
import { MailComposer } from "./mail-composer";
import { ArrowLeft, ExternalLink } from "lucide-react";
import type { GmailThreadMessage } from "@/lib/gmail-client";

function formatSender(from: string): string {
  const match = from.match(/^"?([^"<]+)"?\s*</);
  return match ? match[1].trim() : from;
}

function formatDateTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("zh-TW", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function replaceCidUrls(html: string, msg: GmailThreadMessage): string {
  if (!msg.attachments?.length) return html;
  let result = html;
  for (const att of msg.attachments) {
    const proxyUrl = `/api/gmail/attachment?messageId=${encodeURIComponent(msg.id)}&attachmentId=${encodeURIComponent(att.attachmentId)}&mimeType=${encodeURIComponent(att.mimeType)}`;
    // Match cid: case-insensitively, and also handle URL-encoded CIDs (e.g. %40 for @)
    const escapedCid = att.contentId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const urlEncodedCid = encodeURIComponent(att.contentId).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`cid:(?:${escapedCid}|${urlEncodedCid})`, "gi");
    result = result.replace(pattern, proxyUrl);
  }
  return result;
}

function MessageBubble({ msg, isLast }: { msg: GmailThreadMessage; isLast: boolean }) {
  const sanitizedHtml = useMemo(() => {
    if (msg.mimeType !== "text/html") return "";
    // Replace cid: references before sanitization so DOMPurify sees valid URLs
    const withProxiedImages = replaceCidUrls(msg.body, msg);
    return DOMPurify.sanitize(withProxiedImages, {
      ALLOWED_TAGS: [
        "p", "br", "b", "i", "u", "strong", "em", "a", "ul", "ol", "li",
        "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre", "code",
        "table", "thead", "tbody", "tr", "th", "td", "div", "span", "img", "hr",
      ],
      ALLOWED_ATTR: ["href", "src", "alt", "title", "class", "style", "target", "rel"],
      ALLOW_DATA_ATTR: false,
    });
  }, [msg]);

  return (
    <div className={`rounded-lg border border-cy-input/30 bg-cy-card p-3 ${isLast ? "" : "opacity-70"}`}>
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-medium text-cy-text">{formatSender(msg.from)}</span>
        <span className="text-cy-muted">{formatDateTime(msg.date)}</span>
      </div>
      {msg.mimeType === "text/html" ? (
        <div
          className="prose prose-sm max-w-none rounded bg-white p-2 text-gray-900 [&_a]:text-blue-600 [&_img]:max-w-full [&_img]:h-auto [&_table]:text-xs [&_table]:w-full [&_td]:break-words overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />
      ) : (
        <pre className="whitespace-pre-wrap text-xs leading-relaxed text-cy-text/80">{msg.body}</pre>
      )}
    </div>
  );
}

export function MailDetail() {
  const { selectedThread, isThreadLoading, setSelectedThread, setSelectedMessageId } =
    useGmailStore();

  if (isThreadLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-cy-muted">
        載入對話串...
      </div>
    );
  }

  if (!selectedThread) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-cy-muted">
        選擇一封郵件來閱讀
      </div>
    );
  }

  const firstMsg = selectedThread.messages[0];
  const threadUrl = `https://mail.google.com/mail/u/0/#inbox/${selectedThread.id}`;

  function handleBack() {
    setSelectedThread(null);
    setSelectedMessageId(null);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-cy-input/30 pb-2">
        <button
          onClick={handleBack}
          className="rounded p-1 text-cy-muted transition-colors hover:bg-cy-input/40 hover:text-cy-text"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h3 className="flex-1 truncate text-sm font-medium text-cy-text">
          {firstMsg?.subject || "(無主旨)"}
        </h3>
        <a
          href={threadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded p-1 text-cy-muted transition-colors hover:bg-cy-input/40 hover:text-cy-accent"
          title="在 Gmail 中開啟"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-2 overflow-auto py-2">
        {selectedThread.messages.map((msg, i) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            isLast={i === selectedThread.messages.length - 1}
          />
        ))}
      </div>

      {/* AI Tools: classify + compose */}
      <div className="space-y-3 border-t border-cy-input/30 pt-3">
        <LabelManager />
        <MailComposer />
      </div>
    </div>
  );
}
