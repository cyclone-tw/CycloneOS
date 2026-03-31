// src/lib/felo/search.ts

import { feloFetch } from "./client";
import type { FeloSearchResponse, FeloResource } from "./types";

export interface FeloSearchResult {
  answer: string;
  resources: FeloResource[];
}

export async function feloSearch(query: string): Promise<FeloSearchResult> {
  const res = await feloFetch<FeloSearchResponse>("/v2/chat", {
    body: { query },
  });

  return {
    answer: res.data?.answer || "",
    resources: res.data?.resources || [],
  };
}
