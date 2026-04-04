import { type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

interface NotionBlock {
  type: string;
  [key: string]: unknown;
}

/** Extract plain text from a Notion rich_text array */
function richTextToString(richText: Array<{ plain_text: string }> | undefined): string {
  return richText?.map((t) => t.plain_text).join("") || "";
}

/** Convert Notion blocks to simple markdown */
function blocksToMarkdown(blocks: NotionBlock[]): string {
  const lines: string[] = [];

  for (const block of blocks) {
    const b = block as Record<string, unknown>;
    const data = b[block.type] as Record<string, unknown> | undefined;
    if (!data) continue;

    const text = richTextToString(data.rich_text as Array<{ plain_text: string }>);

    switch (block.type) {
      case "heading_1":
        lines.push(`# ${text}`);
        break;
      case "heading_2":
        lines.push(`## ${text}`);
        break;
      case "heading_3":
        lines.push(`### ${text}`);
        break;
      case "paragraph":
        lines.push(text);
        break;
      case "bulleted_list_item":
        lines.push(`- ${text}`);
        break;
      case "numbered_list_item":
        lines.push(`1. ${text}`);
        break;
      case "to_do": {
        const checked = (data.checked as boolean) ? "x" : " ";
        lines.push(`- [${checked}] ${text}`);
        break;
      }
      case "toggle":
        lines.push(`> ${text}`);
        break;
      case "quote":
        lines.push(`> ${text}`);
        break;
      case "callout":
        lines.push(`> ${text}`);
        break;
      case "divider":
        lines.push("---");
        break;
      default:
        if (text) lines.push(text);
    }
  }

  return lines.join("\n");
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.NOTION_API_KEY;
  const pageId = request.nextUrl.searchParams.get("id");

  if (!apiKey) {
    return Response.json({ error: "Notion not configured" }, { status: 502 });
  }

  if (!pageId) {
    return Response.json({ error: "Missing page id" }, { status: 400 });
  }

  try {
    const response = await fetch(`${NOTION_API}/blocks/${pageId}/children?page_size=100`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Notion-Version": NOTION_VERSION,
      },
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[notion/page] Error:", response.status, err);
      return Response.json({ error: `Notion API ${response.status}` }, { status: 502 });
    }

    const data = await response.json();
    const markdown = blocksToMarkdown(data.results as NotionBlock[]);

    return Response.json({ content: markdown });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
