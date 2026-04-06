// src/lib/social/notion.ts
// Notion integration for the Social Posting workstation.

import { markdownToBlocks, notionFetch } from "@/lib/notion-utils";
import type { Platform } from "./prompts";

// --- Constants ---

export const PLATFORM_LABELS: Record<Platform, string> = {
  fb: "FB",
  ig: "IG",
  line: "LINE",
  school: "學校網站",
  notion: "Notion",
};

// --- Types ---

export interface CreateSocialPostParams {
  title: string;
  platforms: Platform[];
  contents: Partial<Record<Platform, string>>;
  hashtags?: string[];
  imageUrls?: string[];
  publishDate?: string;
  tags?: string[];
  tone?: string;
  source?: string;
}

interface NotionPostRecord {
  id: string;
  title: string;
  platforms: Platform[];
  published: Platform[];
  status: string;
  date: string | null;
  notionUrl: string;
}

// --- Helpers ---

/** Cap a string at Notion's 2000-char rich text limit */
function cap2000(text: string): string {
  return text.length > 2000 ? text.slice(0, 2000) : text;
}

/**
 * Build the page body markdown.
 * - If "notion" is a selected platform with content: notion content is the main body,
 *   other platforms go under "## 各平台版本".
 * - Otherwise: each platform version under its own "## PlatformLabel" heading.
 * - Hashtags appended at the end after `---`.
 */
export function buildPageBody(
  platforms: Platform[],
  contents: Partial<Record<Platform, string>>,
  hashtags?: string[]
): string {
  const parts: string[] = [];

  const hasNotion = platforms.includes("notion") && contents["notion"];

  if (hasNotion) {
    // Main body = notion content
    parts.push(contents["notion"]!);

    // Appendix: other platforms
    const others = platforms.filter((p) => p !== "notion");
    if (others.length > 0) {
      parts.push("\n## 各平台版本\n");
      for (const p of others) {
        const text = contents[p];
        if (text) {
          parts.push(`### ${PLATFORM_LABELS[p]}\n\n${text}`);
        }
      }
    }
  } else {
    // Each platform as its own section
    for (const p of platforms) {
      const text = contents[p];
      if (text) {
        parts.push(`## ${PLATFORM_LABELS[p]}\n\n${text}`);
      }
    }
  }

  if (hashtags && hashtags.length > 0) {
    parts.push(`\n---\n\n${hashtags.map((h) => `#${h}`).join(" ")}`);
  }

  return parts.join("\n\n");
}

// --- API Functions ---

/** Create a new social post page in Notion */
export async function createSocialPost(
  params: CreateSocialPostParams
): Promise<{ notionUrl: string; pageId: string }> {
  const databaseId = process.env.NOTION_SOCIAL_DATABASE_ID;
  if (!databaseId) {
    throw new Error("[social/notion] Missing NOTION_SOCIAL_DATABASE_ID");
  }

  const { title, platforms, contents, hashtags, imageUrls, publishDate, tags, tone, source } = params;

  /** Shorthand: build a rich_text array from a string */
  const rt = (text: string) => [{ type: "text", text: { content: cap2000(text) } }];

  // Build Notion properties
  const properties: Record<string, unknown> = {
    // Title (database title property)
    Title: {
      title: [{ type: "text", text: { content: cap2000(title) } }],
    },
    // Status (status type, not select)
    Status: {
      status: { name: "草稿" },
    },
    // Platforms: multi_select
    Platforms: {
      multi_select: platforms.map((p) => ({ name: PLATFORM_LABELS[p] })),
    },
  };

  if (publishDate) {
    properties["Publish Date"] = { date: { start: publishDate } };
  }

  if (tags && tags.length > 0) {
    properties["Tags"] = {
      multi_select: tags.map((t) => ({ name: t })),
    };
  }

  if (tone) {
    properties["Tone"] = {
      select: { name: tone },
    };
  }

  if (source) {
    properties["Source"] = {
      rich_text: rt(source),
    };
  }

  if (hashtags && hashtags.length > 0) {
    const hashtagStr = hashtags.join(", ");
    properties["Hashtags"] = {
      rich_text: rt(hashtagStr),
    };
  }

  // Per-platform content properties
  if (contents.fb) properties["Content FB"] = { rich_text: rt(contents.fb) };
  if (contents.ig) properties["Content IG"] = { rich_text: rt(contents.ig) };
  if (contents.line) properties["Content LINE"] = { rich_text: rt(contents.line) };
  if (contents.school) properties["Content School"] = { rich_text: rt(contents.school) };

  // Image URLs
  if (imageUrls?.length) properties["Image URLs"] = { rich_text: rt(imageUrls.join(",")) };

  // Build page body
  const bodyMarkdown = buildPageBody(platforms, contents, hashtags);
  const children = markdownToBlocks(bodyMarkdown);

  const response = await notionFetch("/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { database_id: databaseId },
      properties,
      children,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`[social/notion] Notion API error ${response.status}: ${err}`);
  }

  const page = (await response.json()) as { id: string; url: string };
  return {
    pageId: page.id,
    notionUrl: page.url,
  };
}

/** Fetch recent social posts from the Notion database */
export async function fetchSocialHistory(limit = 20): Promise<NotionPostRecord[]> {
  const databaseId = process.env.NOTION_SOCIAL_DATABASE_ID;
  if (!databaseId) {
    throw new Error("[social/notion] Missing NOTION_SOCIAL_DATABASE_ID");
  }

  const response = await notionFetch(`/databases/${databaseId}/query`, {
    method: "POST",
    body: JSON.stringify({
      sorts: [{ timestamp: "created_time", direction: "descending" }],
      page_size: limit,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`[social/notion] Notion API error ${response.status}: ${err}`);
  }

  const data = (await response.json()) as {
    results: Array<{
      id: string;
      url: string;
      created_time: string;
      properties: Record<string, unknown>;
    }>;
  };

  return data.results.map((page) => {
    const props = page.properties;

    // Title
    const titleProp = props["Title"] as { title?: Array<{ plain_text: string }> } | undefined;
    const title = titleProp?.title?.[0]?.plain_text ?? "(無標題)";

    // Platforms
    const platformsProp = props["Platforms"] as
      | { multi_select?: Array<{ name: string }> }
      | undefined;
    const platformNames = platformsProp?.multi_select?.map((m) => m.name) ?? [];
    const labelToKey = Object.fromEntries(
      Object.entries(PLATFORM_LABELS).map(([k, v]) => [v, k])
    ) as Record<string, Platform>;
    const platforms = platformNames
      .map((name) => labelToKey[name])
      .filter(Boolean) as Platform[];

    // Published platforms
    const publishedProp = props["Published"] as
      | { multi_select?: Array<{ name: string }> }
      | undefined;
    const publishedNames = publishedProp?.multi_select?.map((m) => m.name) ?? [];
    const published = publishedNames
      .map((name) => labelToKey[name])
      .filter(Boolean) as Platform[];

    // Status (status type, not select)
    const statusProp = props["Status"] as { status?: { name: string } } | undefined;
    const status = statusProp?.status?.name ?? "草稿";

    // Date
    const dateProp = props["Publish Date"] as { date?: { start: string } } | undefined;
    const date = dateProp?.date?.start ?? null;

    return {
      id: page.id,
      title,
      platforms,
      published,
      status,
      date,
      notionUrl: page.url,
    };
  });
}
