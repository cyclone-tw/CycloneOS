import type { VideoMeta } from "./types";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

interface CreatePageParams {
  meta: VideoMeta;
  topics: string[];
  summaryMarkdown: string;
  obsidianPath: string;
}

/** Create a page in the YT 深度研究 Notion database */
export async function createNotionPage(params: CreatePageParams): Promise<string | null> {
  const apiKey = process.env.NOTION_API_KEY;
  const databaseId = process.env.NOTION_YT_NOTES_DATABASE_ID;

  if (!apiKey || !databaseId) {
    console.warn("[notion] Missing NOTION_API_KEY or NOTION_YT_NOTES_DATABASE_ID");
    return null;
  }

  const { meta, topics, summaryMarkdown, obsidianPath } = params;

  const body = {
    parent: { database_id: databaseId },
    properties: {
      Title: { title: [{ text: { content: meta.title } }] },
      Channel: { select: { name: meta.channel } },
      URL: { url: meta.url },
      Date: { date: { start: meta.uploadDate } },
      Duration: { rich_text: [{ text: { content: meta.duration } }] },
      Language: { select: { name: meta.language } },
      Topics: { multi_select: topics.slice(0, 10).map((t) => ({ name: t })) },
      "Has Transcript": { checkbox: true },
      "Obsidian Path": { rich_text: [{ text: { content: obsidianPath } }] },
      Status: { status: { name: "Done" } },
    },
    children: markdownToBlocks(summaryMarkdown),
  };

  const response = await fetch(`${NOTION_API}/pages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("[notion] Failed to create page:", response.status, err);
    return null;
  }

  const data = await response.json();
  return data.url || null;
}

/** Convert markdown summary into Notion block children (simplified) */
function markdownToBlocks(md: string): object[] {
  const blocks: object[] = [];
  const lines = md.split("\n");

  for (const line of lines) {
    if (!line.trim()) continue;

    const h2 = line.match(/^## (.+)/);
    if (h2) {
      blocks.push({
        object: "block",
        type: "heading_2",
        heading_2: { rich_text: [{ text: { content: h2[1] } }] },
      });
      continue;
    }

    const h1 = line.match(/^# (.+)/);
    if (h1) {
      blocks.push({
        object: "block",
        type: "heading_1",
        heading_1: { rich_text: [{ text: { content: h1[1] } }] },
      });
      continue;
    }

    if (line.startsWith("- ")) {
      blocks.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [{ text: { content: line.slice(2) } }],
        },
      });
      continue;
    }

    blocks.push({
      object: "block",
      type: "paragraph",
      paragraph: { rich_text: [{ text: { content: line } }] },
    });
  }

  return blocks.slice(0, 100);
}
