import { parseCommitteeFile, writeCommitteeFile } from "@/lib/education/committee-parser";
import type { CommitteeMember } from "@/lib/education/committee-parser";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const yearStr = url.searchParams.get("year");
  if (!yearStr) {
    return Response.json({ error: "Missing year parameter" }, { status: 400 });
  }

  const year = parseInt(yearStr, 10);
  if (isNaN(year)) {
    return Response.json({ error: "Invalid year" }, { status: 400 });
  }

  try {
    const roster = await parseCommitteeFile(year);
    return Response.json(roster);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      year: number;
      members: CommitteeMember[];
    };

    if (!body.year || !Array.isArray(body.members)) {
      return Response.json({ error: "Missing year or members" }, { status: 400 });
    }

    const path = await writeCommitteeFile({ year: body.year, members: body.members });
    return Response.json({ saved: true, path });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
