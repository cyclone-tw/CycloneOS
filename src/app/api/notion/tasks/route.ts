import { type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface CYTaskItem {
  id: string;
  name: string;
  type: "任務" | "活動";
  status: string;
  priority: string | null;
  date: string | null;
  dateEnd: string | null;
  summary: string;
  url: string;
}

interface NotionProperty {
  type: string;
  title?: Array<{ plain_text: string }>;
  rich_text?: Array<{ plain_text: string }>;
  select?: { name: string } | null;
  date?: { start: string; end: string | null } | null;
  url?: string | null;
  checkbox?: boolean;
}

interface NotionPage {
  id: string;
  url: string;
  properties: Record<string, NotionProperty>;
}

interface NotionResponse {
  results: NotionPage[];
}

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

function getText(prop: NotionProperty | undefined): string {
  if (!prop) return "";
  if (prop.title) return prop.title.map((t) => t.plain_text).join("");
  if (prop.rich_text) return prop.rich_text.map((t) => t.plain_text).join("");
  return "";
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.NOTION_API_KEY;
  const databaseId = process.env.NOTION_CY_TASK_DATABASE_ID;

  if (!apiKey || !databaseId) {
    return Response.json({ tasks: [], events: [], configured: false });
  }

  const typeParam = request.nextUrl.searchParams.get("type"); // "任務" | "活動" | null (both)

  try {
    // Build filter
    const filters: object[] = [
      { property: "狀態", select: { does_not_equal: "已完成" } },
    ];

    if (typeParam) {
      filters.push({ property: "類型", select: { equals: typeParam } });
    }

    // For events, filter to next 7 days
    if (typeParam === "活動") {
      const today = new Date().toISOString().slice(0, 10);
      const next7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      filters.push(
        { property: "日期", date: { on_or_after: today } },
        { property: "日期", date: { on_or_before: next7 } }
      );
    }

    const response = await fetch(`${NOTION_API}/databases/${databaseId}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filter: { and: filters },
        sorts: [{ property: "日期", direction: "ascending" }],
        page_size: 20,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Notion API error:", response.status, errorBody);
      return Response.json(
        { tasks: [], events: [], configured: true, error: `Notion API returned ${response.status}` },
        { status: 502 }
      );
    }

    const data: NotionResponse = await response.json();

    const items: CYTaskItem[] = data.results.map((page) => {
      const p = page.properties;
      return {
        id: page.id,
        name: getText(p["Name"]),
        type: (p["類型"]?.select?.name as "任務" | "活動") || "任務",
        status: p["狀態"]?.select?.name || "",
        priority: p["優先級"]?.select?.name || null,
        date: p["日期"]?.date?.start || null,
        dateEnd: p["日期"]?.date?.end || null,
        summary: getText(p["摘要"]),
        url: page.url,
      };
    });

    const tasks = items.filter((i) => i.type === "任務");

    // Events: filter to next 7 days (including today)
    const today = new Date().toISOString().slice(0, 10);
    const next7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const events = items.filter(
      (i) => i.type === "活動" && i.date && i.date.slice(0, 10) >= today && i.date.slice(0, 10) <= next7
    );

    return Response.json({ tasks, events, configured: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Notion tasks fetch error:", message);
    return Response.json(
      { tasks: [], events: [], configured: true, error: message },
      { status: 500 }
    );
  }
}
