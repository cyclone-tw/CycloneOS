import { type NextRequest } from "next/server";
import {
  getRecentSessions,
  getTodaySessionCount,
} from "@/lib/session-reader";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const daysParam = searchParams.get("days");
  const days = daysParam
    ? Math.max(1, Math.min(30, parseInt(daysParam, 10) || 7))
    : 7;

  try {
    const [sessions, todayCount] = await Promise.all([
      getRecentSessions(days),
      getTodaySessionCount(),
    ]);

    return Response.json({ sessions, todayCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      { error: "Failed to read session logs", detail: message },
      { status: 500 }
    );
  }
}
