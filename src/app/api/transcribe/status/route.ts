import { getJob, getRecentJobs } from "@/lib/yt-notes/job-manager";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("jobId");

  // If no jobId, return recent jobs list
  if (!jobId) {
    const jobs = getRecentJobs();
    return Response.json({ jobs });
  }

  const job = getJob(jobId);
  if (!job) {
    return Response.json({ error: "Job not found" }, { status: 404 });
  }

  return Response.json({
    jobId: job.id,
    status: job.status,
    step: job.step,
    meta: job.meta,
    result: job.result,
    error: job.error,
  });
}
