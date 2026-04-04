import { createJob } from "@/lib/yt-notes/job-manager";
import { parseYouTubeUrl } from "@/lib/yt-notes/youtube-dl";
import { runPipeline } from "@/lib/yt-notes/pipeline";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { url } = (await request.json()) as { url: string };

    if (!url || !parseYouTubeUrl(url)) {
      return Response.json(
        { error: "Invalid or missing YouTube URL" },
        { status: 400 }
      );
    }

    const job = createJob(url);

    // Fire and forget — pipeline runs in background
    runPipeline(job).catch((err) =>
      console.error("[transcribe/youtube] Pipeline error:", err)
    );

    return Response.json({ jobId: job.id, status: job.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
