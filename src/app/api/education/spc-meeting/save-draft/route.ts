// src/app/api/education/spc-meeting/save-draft/route.ts
import { saveSessionToFile, type SpcSessionData } from "@/lib/education/spc-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const data: SpcSessionData = {
      meta: {
        type: "特推會會議",
        academic_year: body.academicYear ?? 114,
        meeting_number: body.meetingNumber ?? 1,
        date: body.date ?? "",
        time_start: body.timeStart ?? "",
        time_end: body.timeEnd ?? undefined,
        location: body.location ?? "",
        chair: body.chair ?? "",
        recorder: body.recorder ?? "",
        status: body.status ?? "draft",
        mode: body.mode ?? "prep",
        ref_files: body.refFiles ?? [],
        topics: (body.proposals ?? []).map((p: { type?: string }) => p.type).filter(Boolean),
        decisions: (body.proposals ?? []).map((p: { decision?: string }) => p.decision).filter(Boolean),
        tags: ["特推會"],
      },
      previousDecisions: body.previousDecisions ?? "",
      businessReport: body.businessReport ?? "",
      proposals: (body.proposals ?? []).map((p: Record<string, unknown>) => ({
        type: (p.type as string) ?? "",
        title: (p.title as string) ?? "",
        description: (p.description as string) ?? "",
        decision: (p.decision as string) ?? "",
        students: (p.students as Array<{ name: string; className: string; disability: string; detail: string }>) ?? [],
        refDoc: (p.refDoc as string) ?? "",
        refFiles: (p.refFiles as Array<{ path: string; name: string }>) ?? undefined,
      })),
      motions: body.motions ?? "無",
    };

    const filepath = await saveSessionToFile(data);

    return Response.json({ saved: true, path: filepath });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
