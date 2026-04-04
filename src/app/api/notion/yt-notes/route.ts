import { createNotionPage } from "@/lib/yt-notes/notion";
import type { VideoMeta } from "@/lib/yt-notes/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { meta, topics, summaryMarkdown, obsidianPath } = body as {
      meta: VideoMeta;
      topics: string[];
      summaryMarkdown: string;
      obsidianPath: string;
    };

    const notionUrl = await createNotionPage({ meta, topics, summaryMarkdown, obsidianPath });

    if (!notionUrl) {
      return Response.json(
        { error: "Notion not configured or API error" },
        { status: 502 }
      );
    }

    return Response.json({ url: notionUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
