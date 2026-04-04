import { spawn } from "child_process";
import { mkdir } from "fs/promises";
import { join } from "path";
import { PATHS } from "@/config/paths-config";
import type { VideoMeta } from "./types";

/** Validate YouTube URL and extract video ID */
export function parseYouTubeUrl(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

/** Run a command and return stdout as string */
function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
    proc.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
    proc.on("close", (code) =>
      code === 0 ? resolve(stdout) : reject(new Error(`${cmd} exited ${code}: ${stderr}`))
    );
    proc.on("error", reject);
  });
}

/** Format seconds to "MM:SS" or "H:MM:SS" */
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Sanitize title for filesystem use — keep CJK, alphanumeric, hyphens */
function sanitizeTitle(title: string): string {
  return title
    .replace(/[/\\:*?"<>|]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

export interface DownloadResult {
  meta: VideoMeta;
  outputDir: string;
  audioPath: string;
  subtitlePath: string | null;
  subtitleSource: "native" | "auto" | null;
}

/** Download video metadata, subtitles, and audio */
export async function downloadVideo(url: string): Promise<DownloadResult> {
  // 1. Fetch metadata as JSON
  const metaJson = await run("yt-dlp", [
    "--dump-json",
    "--no-download",
    url,
  ]);
  const raw = JSON.parse(metaJson);

  const uploadDate = raw.upload_date
    ? `${raw.upload_date.slice(0, 4)}-${raw.upload_date.slice(4, 6)}-${raw.upload_date.slice(6, 8)}`
    : new Date().toISOString().slice(0, 10);

  const meta: VideoMeta = {
    videoId: raw.id,
    title: raw.title || "Untitled",
    channel: raw.channel || raw.uploader || "",
    channelId: raw.channel_id || "",
    uploadDate,
    duration: formatDuration(raw.duration || 0),
    durationSeconds: raw.duration || 0,
    language: raw.language || detectLanguage(raw),
    thumbnailUrl: raw.thumbnail || "",
    url,
  };

  // 2. Create output directory: Draco/yt-notes/{date}-{title}/
  const dirName = `${uploadDate}-${sanitizeTitle(meta.title)}`;
  const outputDir = join(PATHS.ytNotes, dirName);
  await mkdir(outputDir, { recursive: true });

  // 3. Download audio as MP3
  const audioPath = join(outputDir, `${uploadDate}-${sanitizeTitle(meta.title)}.mp3`);
  await run("yt-dlp", [
    "-x",
    "--audio-format", "mp3",
    "--audio-quality", "5",
    "-o", audioPath,
    url,
  ]);

  // 4. Try to download subtitles (prefer native, then auto-generated)
  let subtitlePath: string | null = null;
  let subtitleSource: "native" | "auto" | null = null;

  const subBaseName = join(outputDir, "sub");
  try {
    await run("yt-dlp", [
      "--write-subs",
      "--skip-download",
      "--sub-format", "vtt",
      "--sub-langs", `${meta.language},en,zh-Hant,zh-Hans,zh`,
      "-o", subBaseName,
      url,
    ]);
    const foundSub = await findSubtitleFile(outputDir, "sub");
    if (foundSub) {
      subtitlePath = foundSub;
      subtitleSource = "native";
    }
  } catch {
    // No native subs available
  }

  if (!subtitlePath) {
    try {
      await run("yt-dlp", [
        "--write-auto-subs",
        "--skip-download",
        "--sub-format", "vtt",
        "--sub-langs", `${meta.language},en,zh-Hant,zh-Hans,zh`,
        "-o", subBaseName,
        url,
      ]);
      const foundSub = await findSubtitleFile(outputDir, "sub");
      if (foundSub) {
        subtitlePath = foundSub;
        subtitleSource = "auto";
      }
    } catch {
      // No auto subs either
    }
  }

  return { meta, outputDir, audioPath, subtitlePath, subtitleSource };
}

async function findSubtitleFile(dir: string, baseName: string): Promise<string | null> {
  const { readdir } = await import("fs/promises");
  const files = await readdir(dir);
  const sub = files.find((f) => f.startsWith(baseName) && f.endsWith(".vtt"));
  return sub ? join(dir, sub) : null;
}

function detectLanguage(raw: Record<string, unknown>): string {
  if (raw.language && typeof raw.language === "string") return raw.language;
  const title = (raw.title as string) || "";
  if (/[\u4e00-\u9fff]/.test(title)) return "zh";
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(title)) return "ja";
  if (/[\uac00-\ud7af]/.test(title)) return "ko";
  return "en";
}
