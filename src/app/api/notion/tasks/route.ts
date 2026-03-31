import { type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface NotionTask {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  priority: string | null;
  url: string;
}

interface NotionProperty {
  type: string;
  title?: Array<{ plain_text: string }>;
  rich_text?: Array<{ plain_text: string }>;
  status?: { name: string };
  select?: { name: string } | null;
  date?: { start: string } | null;
  url?: string;
}

interface NotionPage {
  id: string;
  url: string;
  properties: Record<string, NotionProperty>;
}

interface NotionResponse {
  results: NotionPage[];
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.NOTION_API_KEY;
  const databaseId = process.env.NOTION_TASKS_DATABASE_ID;

  if (!apiKey || !databaseId) {
    return Response.json({ tasks: [], configured: false });
  }

  try {
    const response = await fetch(
      `https://api.notion.com/v1/databases/${databaseId}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filter: {
            and: [
              {
                property: "Status",
                status: {
                  does_not_equal: "Done",
                },
              },
            ],
          },
          sorts: [
            {
              property: "Due",
              direction: "ascending",
            },
          ],
          page_size: 10,
        }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Notion API error:", response.status, errorBody);
      return Response.json(
        {
          tasks: [],
          configured: true,
          error: `Notion API returned ${response.status}`,
        },
        { status: 502 }
      );
    }

    const data: NotionResponse = await response.json();

    const tasks: NotionTask[] = data.results.map((page) => {
      const props = page.properties;

      // Extract title — try common property names
      const titleProp =
        props["Name"] || props["Title"] || props["name"] || props["title"];
      const title =
        titleProp?.title?.[0]?.plain_text ||
        titleProp?.rich_text?.[0]?.plain_text ||
        "Untitled";

      // Extract status
      const statusProp = props["Status"] || props["status"];
      const status = statusProp?.status?.name || statusProp?.select?.name || "";

      // Extract due date
      const dueProp = props["Due"] || props["Due Date"] || props["due"];
      const dueDate = dueProp?.date?.start || null;

      // Extract priority
      const priorityProp = props["Priority"] || props["priority"];
      const priority = priorityProp?.select?.name || null;

      return {
        id: page.id,
        title,
        status,
        dueDate,
        priority,
        url: page.url,
      };
    });

    return Response.json({ tasks, configured: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Notion tasks fetch error:", message);
    return Response.json(
      { tasks: [], configured: true, error: message },
      { status: 500 }
    );
  }
}
