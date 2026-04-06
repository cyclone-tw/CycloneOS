// src/app/api/social/history/route.ts
// GET — fetch recent social post history from Notion.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { fetchSocialHistory } from "@/lib/social/notion";

export async function GET() {
  try {
    const posts = await fetchSocialHistory();
    return Response.json({ posts });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ error: message }, { status: 500 });
  }
}
