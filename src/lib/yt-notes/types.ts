export type JobStatus = "processing" | "completed" | "failed";
export type JobStep = "downloading" | "transcribing" | "summarizing" | "saving";

export interface VideoMeta {
  videoId: string;
  title: string;
  channel: string;
  channelId: string;
  uploadDate: string;       // YYYY-MM-DD
  duration: string;         // "32:15"
  durationSeconds: number;
  language: string;         // "zh", "en", "ja", etc.
  thumbnailUrl: string;
  url: string;
}

export interface JobResult {
  obsidianPath: string;
  notionUrl: string;
  title: string;
}

export interface Job {
  id: string;
  url: string;
  status: JobStatus;
  step: JobStep;
  meta?: VideoMeta;
  result?: JobResult;
  error?: string;
  createdAt: number;
}
