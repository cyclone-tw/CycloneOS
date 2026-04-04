"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { YtInput } from "./yt-input";
import { JobProgress } from "./job-progress";
import { JobHistory } from "./job-history";

interface JobData {
  id: string;
  status: "processing" | "completed" | "failed";
  step: string;
  meta?: { title: string; channel: string; duration: string; url: string };
  result?: { obsidianPath: string; notionUrl: string; title: string };
  error?: string;
  createdAt: number;
}

export function TranscribeWorkstation() {
  const { setActiveWorkstation } = useAppStore();
  const [activeJob, setActiveJob] = useState<JobData | null>(null);
  const [history, setHistory] = useState<JobData[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/transcribe/status")
      .then((r) => r.json())
      .then((data) => {
        if (data.jobs) setHistory(data.jobs);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!activeJob || activeJob.status !== "processing") return;

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/transcribe/status?jobId=${activeJob.id}`);
        const data = await res.json();
        setActiveJob(data);

        if (data.status !== "processing") {
          if (pollRef.current) clearInterval(pollRef.current);
          const histRes = await fetch("/api/transcribe/status");
          const histData = await histRes.json();
          if (histData.jobs) setHistory(histData.jobs);
        }
      } catch {
        // Network error — keep polling
      }
    }, 2000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeJob?.id, activeJob?.status]);

  const handleSubmit = useCallback(async (url: string) => {
    try {
      const res = await fetch("/api/transcribe/youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.jobId) {
        setActiveJob({
          id: data.jobId,
          status: "processing",
          step: "downloading",
          createdAt: Date.now(),
        });
      }
    } catch (err) {
      console.error("Submit error:", err);
    }
  }, []);

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 5.5rem)" }}>
      <div className="flex items-center gap-3 border-b border-cy-border pb-3">
        <button
          onClick={() => setActiveWorkstation(null)}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-cy-muted hover:bg-cy-input/50 hover:text-cy-text transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Skills
        </button>
        <span className="text-lg">🎙️</span>
        <h1 className="text-lg font-bold text-cy-text">語音轉錄工作站</h1>
      </div>

      <div className="flex-1 overflow-y-auto py-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border-2 border-cy-accent bg-cy-card p-3 text-center">
              <span className="text-2xl">🎬</span>
              <p className="mt-1 text-xs font-medium text-cy-text">YT 影片</p>
            </div>
            <div className="rounded-lg border border-cy-border bg-cy-card/50 p-3 text-center opacity-50">
              <span className="text-2xl">📱</span>
              <p className="mt-1 text-xs text-cy-muted">手機錄音</p>
              <p className="text-[10px] text-cy-muted">即將推出</p>
            </div>
            <div className="rounded-lg border border-cy-border bg-cy-card/50 p-3 text-center opacity-50">
              <span className="text-2xl">🖥️</span>
              <p className="mt-1 text-xs text-cy-muted">電腦錄影</p>
              <p className="text-[10px] text-cy-muted">即將推出</p>
            </div>
          </div>

          <YtInput
            onSubmit={handleSubmit}
            disabled={activeJob?.status === "processing"}
          />

          {activeJob && (
            <JobProgress
              status={activeJob.status}
              step={activeJob.step}
              title={activeJob.meta?.title}
              error={activeJob.error}
            />
          )}

          <JobHistory
            jobs={history.filter((j) => j.id !== activeJob?.id)}
          />
        </div>
      </div>
    </div>
  );
}
