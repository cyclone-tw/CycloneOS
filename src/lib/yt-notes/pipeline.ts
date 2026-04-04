import { updateJob } from "./job-manager";
import { parseYouTubeUrl, downloadVideo } from "./youtube-dl";
import { getTranscript } from "./transcriber";
import { generateSummary } from "./summarizer";
import { writeSummary, writeTranscript } from "./writer";
import { createNotionPage } from "./notion";
import type { Job } from "./types";
import type { AgentCliProvider } from "@/types/chat";

/** Run the full YouTube processing pipeline in background */
export async function runPipeline(
  job: Job,
  options?: { provider?: AgentCliProvider; model?: string }
): Promise<void> {
  try {
    // Validate URL
    const videoId = parseYouTubeUrl(job.url);
    if (!videoId) {
      updateJob(job.id, { status: "failed", error: "Invalid YouTube URL" });
      return;
    }

    // Step 1: Download
    updateJob(job.id, { step: "downloading" });
    const download = await downloadVideo(job.url);
    updateJob(job.id, { meta: download.meta });

    // Step 2: Transcribe
    updateJob(job.id, { step: "transcribing" });
    const transcript = await getTranscript(
      download.subtitlePath,
      download.subtitleSource,
      download.audioPath,
      download.meta.language
    );

    // Step 3: Summarize
    updateJob(job.id, { step: "summarizing" });
    const summary = await generateSummary(download.meta, transcript.fullText, options);

    // Step 4: Save
    updateJob(job.id, { step: "saving" });

    // Write to Obsidian
    const summaryPath = await writeSummary(
      download.outputDir,
      download.meta,
      summary.summaryMarkdown,
      summary.topics,
      transcript.segments.length > 0
    );
    await writeTranscript(download.outputDir, download.meta, transcript);

    // Write to Notion (non-blocking — don't fail the job if Notion errors)
    let notionUrl = "";
    try {
      const url = await createNotionPage({
        meta: download.meta,
        topics: summary.topics,
        summaryMarkdown: summary.summaryMarkdown,
        obsidianPath: download.outputDir,
      });
      notionUrl = url || "";
    } catch (e) {
      console.error("[pipeline] Notion write failed (non-fatal):", e);
    }

    // Done
    updateJob(job.id, {
      status: "completed",
      result: {
        obsidianPath: summaryPath,
        notionUrl,
        title: download.meta.title,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[pipeline] Failed:", message);
    updateJob(job.id, { status: "failed", error: message });
  }
}
