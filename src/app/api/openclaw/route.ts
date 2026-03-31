import { type NextRequest } from "next/server";
import { getRecentCronOutputs, getTodayCronCount } from "@/lib/obsidian-reader";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const daysParam = searchParams.get("days");
  const days = daysParam ? Math.max(1, Math.min(30, parseInt(daysParam, 10) || 3)) : 3;

  try {
    const [outputs, todayCount] = await Promise.all([
      getRecentCronOutputs(days),
      getTodayCronCount(),
    ]);

    return Response.json({ outputs, todayCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      { error: "Failed to read OpenClaw outputs", detail: message },
      { status: 500 }
    );
  }
}
