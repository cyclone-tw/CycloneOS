import type { Job, JobResult, JobStatus, JobStep, VideoMeta } from "./types";

const jobs = new Map<string, Job>();

export function createJob(url: string): Job {
  const id = `yt-${Date.now()}`;
  const job: Job = {
    id,
    url,
    status: "processing",
    step: "downloading",
    createdAt: Date.now(),
  };
  jobs.set(id, job);
  return job;
}

export function updateJob(
  id: string,
  update: Partial<Pick<Job, "status" | "step" | "meta" | "result" | "error">>
): void {
  const job = jobs.get(id);
  if (job) Object.assign(job, update);
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function getRecentJobs(limit = 20): Job[] {
  return [...jobs.values()]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}
