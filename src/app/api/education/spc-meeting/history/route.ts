import { fetchSimilarMeetings, fetchPreviousDecisions, fetchNextMeetingNumber } from "@/lib/education/spc-history";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const limitStr = url.searchParams.get("limit");
  const yearStr = url.searchParams.get("year");
  const numStr = url.searchParams.get("meetingNumber");

  try {
    let previousDecisions = "";
    if (yearStr && numStr) {
      previousDecisions = await fetchPreviousDecisions(
        parseInt(yearStr, 10),
        parseInt(numStr, 10)
      );
    }

    // Auto-detect next meeting number
    let nextMeetingNumber: number | undefined;
    if (yearStr && !numStr) {
      nextMeetingNumber = await fetchNextMeetingNumber(parseInt(yearStr, 10));
    }

    let records: Awaited<ReturnType<typeof fetchSimilarMeetings>> = [];
    if (type) {
      records = await fetchSimilarMeetings(type, limitStr ? parseInt(limitStr, 10) : 5);
    }

    return Response.json({ records, previousDecisions, nextMeetingNumber });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
