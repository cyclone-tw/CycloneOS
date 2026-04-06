// src/lib/notion-utils.ts
// Shared Notion utilities: block builders, markdown parser, fetch helper.

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

// --- Rich Text Helpers ---

type RichTextItem =
  | { type: "text"; text: { content: string }; annotations?: Record<string, boolean> }

export function richText(content: string, annotations?: Record<string, boolean>): RichTextItem {
  const item: RichTextItem = { type: "text", text: { content } };
  if (annotations) item.annotations = annotations;
  return item;
}

/** Parse inline markdown: bold (**text**) and italic (*text* or _text_) */
export function parseInlineMarkdown(text: string): RichTextItem[] {
  const items: RichTextItem[] = [];
  // Combined regex: **bold**, *italic*, _italic_
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      items.push(richText(text.slice(lastIndex, match.index)));
    }
    if (match[2] !== undefined) {
      // bold
      items.push(richText(match[2], { bold: true }));
    } else if (match[3] !== undefined) {
      // italic *text*
      items.push(richText(match[3], { italic: true }));
    } else if (match[4] !== undefined) {
      // italic _text_
      items.push(richText(match[4], { italic: true }));
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    items.push(richText(text.slice(lastIndex)));
  }

  return items.length > 0 ? items : [richText(text)];
}

// --- Markdown to Notion Blocks ---

/**
 * Convert a markdown string into Notion block children.
 * Supports: h1 (#), h2 (##), h3 (###), bulleted list (- or *),
 * numbered list (1.), bold (**text**), italic (*text*), paragraph.
 * Caps at 100 blocks.
 */
export function markdownToBlocks(md: string): object[] {
  const blocks: object[] = [];
  const lines = md.split("\n");
  let orderedIndex = 0;

  for (const line of lines) {
    if (!line.trim()) {
      orderedIndex = 0;
      continue;
    }

    // h3
    const h3 = line.match(/^### (.+)/);
    if (h3) {
      blocks.push({
        object: "block",
        type: "heading_3",
        heading_3: { rich_text: parseInlineMarkdown(h3[1]) },
      });
      orderedIndex = 0;
      continue;
    }

    // h2
    const h2 = line.match(/^## (.+)/);
    if (h2) {
      blocks.push({
        object: "block",
        type: "heading_2",
        heading_2: { rich_text: parseInlineMarkdown(h2[1]) },
      });
      orderedIndex = 0;
      continue;
    }

    // h1
    const h1 = line.match(/^# (.+)/);
    if (h1) {
      blocks.push({
        object: "block",
        type: "heading_1",
        heading_1: { rich_text: parseInlineMarkdown(h1[1]) },
      });
      orderedIndex = 0;
      continue;
    }

    // bulleted list: - or *
    const bullet = line.match(/^[-*] (.+)/);
    if (bullet) {
      blocks.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: { rich_text: parseInlineMarkdown(bullet[1]) },
      });
      orderedIndex = 0;
      continue;
    }

    // numbered list: 1. 2. etc.
    const numbered = line.match(/^\d+\. (.+)/);
    if (numbered) {
      orderedIndex++;
      blocks.push({
        object: "block",
        type: "numbered_list_item",
        numbered_list_item: { rich_text: parseInlineMarkdown(numbered[1]) },
      });
      continue;
    }

    // paragraph
    blocks.push({
      object: "block",
      type: "paragraph",
      paragraph: { rich_text: parseInlineMarkdown(line) },
    });
    orderedIndex = 0;
  }

  return blocks.slice(0, 100);
}

// --- Notion Fetch Helper ---

/** Make an authenticated request to the Notion API */
export async function notionFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) {
    throw new Error("[notion-utils] Missing NOTION_API_KEY");
  }

  return fetch(`${NOTION_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
}
