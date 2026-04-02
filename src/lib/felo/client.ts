// src/lib/felo/client.ts

const FELO_BASE_URL = process.env.FELO_API_BASE || "https://openapi.felo.ai";

function getApiKey(): string {
  const key = process.env.FELO_API_KEY;
  if (!key) throw new Error("FELO_API_KEY not configured");
  return key;
}

export async function feloFetch<T>(
  path: string,
  options: {
    method?: string;
    body?: Record<string, unknown>;
    timeout?: number;
  } = {},
): Promise<T> {
  const { method = "POST", body, timeout = 60_000 } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(`${FELO_BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "Unknown error");
      throw new Error(`Felo API ${res.status}: ${errorText}`);
    }

    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export function feloStreamUrl(path: string): string {
  return `${FELO_BASE_URL}${path}`;
}

export { getApiKey, FELO_BASE_URL };
