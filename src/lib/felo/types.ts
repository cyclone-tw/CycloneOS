// src/lib/felo/types.ts

// --- Felo Search ---

export interface FeloSearchResponse {
  data: {
    answer: string;
    resources: FeloResource[];
    query_analysis?: string[];
  };
}

export interface FeloResource {
  title?: string;
  link?: string;
  snippet?: string;
}

// --- Felo Web Fetch ---

export interface FeloWebFetchOptions {
  outputFormat?: "html" | "markdown" | "text";
  crawlMode?: "fast" | "fine";
  withReadability?: boolean;
  targetSelector?: string;
  timeout?: number;
}

export interface FeloWebFetchResponse {
  code: number;
  message: string;
  data: {
    content: string;
  };
}

// --- Felo LiveDoc ---

export interface FeloLiveDoc {
  short_id: string;
  name: string;
  description?: string;
  created_at: string;
  modified_at: string;
}

export interface FeloLiveDocListResponse {
  status: string;
  data: {
    total: number;
    items: FeloLiveDoc[];
  };
}

export interface FeloLiveDocCreateResponse {
  status: string;
  data: FeloLiveDoc;
}

// --- Felo SuperAgent ---

export interface FeloConversationResponse {
  stream_key: string;
  thread_short_id: string;
  live_doc_short_id: string;
}

export interface FeloSuperAgentOptions {
  query: string;
  liveDocId: string;
  threadId?: string;
  skillId?: string;
  acceptLanguage?: string;
}

export interface FeloStreamEvent {
  type: "message" | "stream" | "heartbeat" | "done" | "error";
  data?: string;
  offset?: number;
}

export interface FeloToolResult {
  toolName: string;
  title?: string;
  urls?: string[];
  status?: string;
}

export interface FeloSuperAgentResult {
  text: string;
  toolResults: FeloToolResult[];
  threadId: string;
  liveDocId: string;
}

// --- Felo Output Store ---

export interface FeloOutput {
  id: string;
  type: "image" | "document" | "web-fetch";
  localPath: string;
  prompt?: string;
  sourceUrl?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}
