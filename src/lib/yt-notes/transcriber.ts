import { readFile } from "fs/promises";
import { spawn } from "child_process";

export interface TranscriptSegment {
  start: string;   // "00:02:30"
  text: string;
}

export interface TranscriptResult {
  segments: TranscriptSegment[];
  fullText: string;
  source: "native" | "auto" | "whisper";
}

/** Parse VTT subtitle file into segments */
export async function parseVtt(vttPath: string): Promise<TranscriptSegment[]> {
  const content = await readFile(vttPath, "utf-8");
  const segments: TranscriptSegment[] = [];
  const lines = content.split("\n");
  let currentTime = "";

  for (const line of lines) {
    const timeMatch = line.match(/^(\d{2}:\d{2}:\d{2})\.\d{3}\s*-->/);
    if (timeMatch) {
      currentTime = timeMatch[1];
      continue;
    }
    if (!line.trim() || line.startsWith("WEBVTT") || /^\d+$/.test(line.trim())) continue;
    const clean = line.replace(/<[^>]+>/g, "").trim();
    if (!clean) continue;

    const last = segments[segments.length - 1];
    if (last && last.text === clean) continue;

    segments.push({ start: currentTime, text: clean });
  }
  return segments;
}

/** Run Whisper on an audio file */
export async function whisperTranscribe(
  audioPath: string,
  language: string
): Promise<TranscriptSegment[]> {
  const result = await new Promise<string>((resolve, reject) => {
    const args = [
      audioPath,
      "--model", "base",
      "--language", language === "zh" ? "Chinese" : language,
      "--output_format", "vtt",
      "--output_dir", "/tmp/whisper-out",
    ];
    const proc = spawn("whisper", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
    proc.on("close", async (code) => {
      if (code !== 0) return reject(new Error(`whisper exited ${code}: ${stderr}`));
      const { readFile: rf } = await import("fs/promises");
      const { basename, join } = await import("path");
      const base = basename(audioPath, ".mp3");
      const vttPath = join("/tmp/whisper-out", `${base}.vtt`);
      try {
        const content = await rf(vttPath, "utf-8");
        resolve(content);
      } catch {
        reject(new Error("Whisper output file not found"));
      }
    });
    proc.on("error", reject);
  });

  const segments: TranscriptSegment[] = [];
  const lines = result.split("\n");
  let currentTime = "";

  for (const line of lines) {
    const timeMatch = line.match(/^(\d{2}:\d{2}:\d{2})\.\d{3}\s*-->/);
    if (timeMatch) {
      currentTime = timeMatch[1];
      continue;
    }
    const clean = line.replace(/<[^>]+>/g, "").trim();
    if (!clean || clean === "WEBVTT" || /^\d+$/.test(clean)) continue;

    const last = segments[segments.length - 1];
    if (last && last.text === clean) continue;

    segments.push({ start: currentTime, text: clean });
  }
  return segments;
}

/** Get transcript: try VTT first, fallback to Whisper */
export async function getTranscript(
  subtitlePath: string | null,
  subtitleSource: "native" | "auto" | null,
  audioPath: string,
  language: string
): Promise<TranscriptResult> {
  if (subtitlePath) {
    const segments = await parseVtt(subtitlePath);
    if (segments.length > 0) {
      return {
        segments,
        fullText: segments.map((s) => s.text).join("\n"),
        source: subtitleSource!,
      };
    }
  }

  const segments = await whisperTranscribe(audioPath, language);
  return {
    segments,
    fullText: segments.map((s) => s.text).join("\n"),
    source: "whisper",
  };
}
