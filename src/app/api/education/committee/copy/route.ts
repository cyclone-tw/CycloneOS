import { parseCommitteeFile, writeCommitteeFile } from "@/lib/education/committee-parser";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { fromYear, toYear } = (await request.json()) as {
      fromYear: number;
      toYear: number;
    };

    if (!fromYear || !toYear) {
      return Response.json({ error: "Missing fromYear or toYear" }, { status: 400 });
    }

    const source = await parseCommitteeFile(fromYear);
    if (source.members.length === 0) {
      return Response.json({ error: `No roster found for year ${fromYear}` }, { status: 404 });
    }

    const path = await writeCommitteeFile({ year: toYear, members: source.members });
    return Response.json({ saved: true, members: source.members, path });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
