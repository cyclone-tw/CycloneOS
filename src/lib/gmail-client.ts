// dashboard/src/lib/gmail-client.ts
import { google, type gmail_v1 } from "googleapis";

type GmailApiMessage = gmail_v1.Schema$Message;
type GmailApiMessagePart = gmail_v1.Schema$MessagePart;
type GmailApiHeader = gmail_v1.Schema$MessagePartHeader;
type GmailApiBody = gmail_v1.Schema$MessagePartBody;

function getAuth() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });
  return oauth2;
}

export function getGmailClient() {
  const auth = getAuth();
  if (!auth) return null;
  return google.gmail({ version: "v1", auth });
}

export interface GmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  isUnread: boolean;
  labels: string[];
}

export interface GmailThread {
  id: string;
  messages: GmailThreadMessage[];
}

export interface GmailAttachment {
  attachmentId: string;
  contentId: string; // CID without angle brackets
  mimeType: string;
  filename: string;
  size: number;
}

export interface GmailThreadMessage {
  id: string;
  from: string;
  to: string;
  date: string;
  subject: string;
  body: string;
  mimeType: string;
  attachments?: GmailAttachment[];
}

function getHeader(headers: GmailApiHeader[] | null | undefined, name: string): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function decodeBody(body: GmailApiBody | null | undefined): string {
  if (!body?.data) return "";
  return Buffer.from(body.data, "base64url").toString("utf-8");
}

function extractBody(payload: GmailApiMessagePart | null | undefined): { body: string; mimeType: string } {
  // Simple text body
  if (payload?.body?.data) {
    return { body: decodeBody(payload.body), mimeType: payload.mimeType ?? "text/plain" };
  }

  // Multipart — prefer text/html, fallback to text/plain
  if (payload?.parts?.length) {
    const htmlPart = payload.parts.find((part) => part.mimeType === "text/html");
    if (htmlPart?.body?.data) {
      return { body: decodeBody(htmlPart.body), mimeType: "text/html" };
    }
    const textPart = payload.parts.find((part) => part.mimeType === "text/plain");
    if (textPart?.body?.data) {
      return { body: decodeBody(textPart.body), mimeType: "text/plain" };
    }
    // Nested multipart
    for (const part of payload.parts) {
      if (part.parts) {
        const nested = extractBody(part);
        if (nested.body) return nested;
      }
    }
  }

  return { body: "", mimeType: "text/plain" };
}

export function parseMessage(msg: GmailApiMessage): GmailMessage {
  const headers = msg.payload?.headers ?? [];
  return {
    id: msg.id ?? "",
    threadId: msg.threadId ?? "",
    subject: getHeader(headers, "Subject"),
    from: getHeader(headers, "From"),
    to: getHeader(headers, "To"),
    date: getHeader(headers, "Date"),
    snippet: msg.snippet ?? "",
    isUnread: (msg.labelIds ?? []).includes("UNREAD"),
    labels: msg.labelIds ?? [],
  };
}

function extractInlineAttachments(payload: GmailApiMessagePart | null | undefined): GmailAttachment[] {
  const attachments: GmailAttachment[] = [];

  function walk(part: GmailApiMessagePart | null | undefined) {
    if (!part) return;
    const headers = part.headers ?? [];
    const contentId = getHeader(headers, "Content-ID");
    const attachmentId = part.body?.attachmentId;

    if (contentId && attachmentId) {
      // Strip angle brackets and whitespace: < image001.png@01D... > → image001.png@01D...
      const cid = contentId.replace(/^[<\s]+|[\s>]+$/g, "");
      attachments.push({
        attachmentId,
        contentId: cid,
        mimeType: part.mimeType ?? "application/octet-stream",
        filename: part.filename ?? "",
        size: part.body?.size ?? 0,
      });
    }

    if (part.parts) {
      for (const child of part.parts) {
        walk(child);
      }
    }
  }

  walk(payload);
  return attachments;
}

export function parseThreadMessage(msg: GmailApiMessage): GmailThreadMessage {
  const headers = msg.payload?.headers ?? [];
  const { body, mimeType } = extractBody(msg.payload ?? {});
  const attachments = extractInlineAttachments(msg.payload ?? {});
  return {
    id: msg.id ?? "",
    from: getHeader(headers, "From"),
    to: getHeader(headers, "To"),
    date: getHeader(headers, "Date"),
    subject: getHeader(headers, "Subject"),
    body,
    mimeType,
    ...(attachments.length > 0 ? { attachments } : {}),
  };
}
