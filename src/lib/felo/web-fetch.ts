// src/lib/felo/web-fetch.ts

import { feloFetch } from "./client";
import type { FeloWebFetchOptions, FeloWebFetchResponse } from "./types";

export async function feloWebFetch(
  url: string,
  options: FeloWebFetchOptions = {},
): Promise<string> {
  const {
    outputFormat = "markdown",
    crawlMode = "fast",
    withReadability = true,
    targetSelector,
    timeout = 60_000,
  } = options;

  const body: Record<string, unknown> = {
    url,
    output_format: outputFormat,
    crawl_mode: crawlMode,
    with_readability: withReadability,
  };

  if (targetSelector) body.target_selector = targetSelector;

  const res = await feloFetch<FeloWebFetchResponse>("/v2/web/extract", {
    body,
    timeout,
  });

  return res.data?.content || "";
}
