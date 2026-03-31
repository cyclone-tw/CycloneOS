import type { NextRequest } from "next/server";
import { readAuditEntries, countTodayOps } from "@/lib/audit-reader";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.max(1, parseInt(limitParam, 10) || 100) : 100;

  try {
    const [entries, todayCount] = await Promise.all([
      readAuditEntries(limit),
      countTodayOps(),
    ]);

    return Response.json({ entries, todayCount });
  } catch (error) {
    return Response.json(
      { error: "Failed to read audit log", entries: [], todayCount: 0 },
      { status: 500 }
    );
  }
}
