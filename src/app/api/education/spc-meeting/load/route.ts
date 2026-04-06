// src/app/api/education/spc-meeting/load/route.ts
import { findDraftSessions, loadSessionFromFile } from "@/lib/education/spc-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET: List draft/in-progress sessions */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year") ? parseInt(searchParams.get("year")!, 10) : undefined;

    const drafts = await findDraftSessions(year);
    return Response.json({ drafts });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

/** POST: Load a specific session file */
export async function POST(request: Request) {
  try {
    const { filename } = await request.json();
    if (!filename) {
      return Response.json({ error: "Missing filename" }, { status: 400 });
    }

    const session = await loadSessionFromFile(filename);
    if (!session) {
      return Response.json({ error: "File not found or parse failed" }, { status: 404 });
    }

    return Response.json({ session });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
