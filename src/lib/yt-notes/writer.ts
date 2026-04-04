import { writeFile } from "fs/promises";
import { join } from "path";
import type { VideoMeta } from "./types";
import type { TranscriptResult } from "./transcriber";
import { sanitizeTitle } from "./youtube-dl";

/** Write summary markdown with frontmatter to Obsidian */
export async function writeSummary(
  outputDir: string,
  meta: VideoMeta,
  summaryMarkdown: string,
  topics: string[],
  hasTranscript: boolean
): Promise<string> {
  const fileName = `${meta.uploadDate}-${sanitizeTitle(meta.title)}-摘要.md`;
  const filePath = join(outputDir, fileName);

  const topicsYaml = topics.map((t) => `  - "${yamlEscape(t)}"`).join("\n");

  const content = `---
type: yt-summary
title: "${yamlEscape(meta.title)}"
channel: "${yamlEscape(meta.channel)}"
channel_id: "${yamlEscape(meta.channelId)}"
date: ${meta.uploadDate}
url: "${yamlEscape(meta.url)}"
lang: ${meta.language}
duration: "${meta.duration}"
source: manual
transcript: ${hasTranscript}
topics:
${topicsYaml}
tags: [draco, yt-summary]
---

![${meta.title}](${meta.url})

${summaryMarkdown}
`;

  await writeFile(filePath, content, "utf-8");
  return filePath;
}

/** Write transcript markdown to Obsidian */
export async function writeTranscript(
  outputDir: string,
  meta: VideoMeta,
  transcript: TranscriptResult
): Promise<string> {
  const fileName = `${meta.uploadDate}-${sanitizeTitle(meta.title)}-逐字稿.md`;
  const filePath = join(outputDir, fileName);

  const body = transcript.segments
    .map((s) => (s.start ? `[${s.start}] ${s.text}` : s.text))
    .join("\n");

  const content = `---
type: yt-transcript
title: "${yamlEscape(meta.title)}"
channel: "${yamlEscape(meta.channel)}"
date: ${meta.uploadDate}
url: "${yamlEscape(meta.url)}"
source: ${transcript.source}
---

# ${meta.title} — 逐字稿

${body}
`;

  await writeFile(filePath, content, "utf-8");
  return filePath;
}

/** Escape special characters for YAML double-quoted strings */
function yamlEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
