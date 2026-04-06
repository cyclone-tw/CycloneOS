// src/app/api/social/publish-notion/route.ts
// POST — save a social post draft to Notion.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createSocialPost, type CreateSocialPostParams } from "@/lib/social/notion";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateSocialPostParams;

    if (!body.title || !body.title.trim()) {
      return Response.json({ error: "title is required" }, { status: 400 });
    }
    if (!body.platforms || body.platforms.length === 0) {
      return Response.json({ error: "platforms must have at least 1 item" }, { status: 400 });
    }

    const result = await createSocialPost(body);
    return Response.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ error: message }, { status: 500 });
  }
}
