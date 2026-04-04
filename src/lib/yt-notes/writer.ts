import { writeFile } from "fs/promises";
import { join } from "path";
import type { VideoMeta } from "./types";
import type { TranscriptResult } from "./transcriber";

/** Write summary markdown with frontmatter to Obsidian */
export async function writeSummary(
  outputDir: string,
  meta: VideoMeta,
  summaryMarkdown: string,
  topics: string[],
  hasTranscript: boolean
): Promise<string> {
  const fileName = `${meta.uploadDate}-${sanitize(meta.title)}-摘要.md`;
  const filePath = join(outputDir, fileName);

  const topicsYaml = topics.map((t) => `  - "${t}"`).join("\n");

  const content = `---
type: yt-summary
title: "${meta.title}"
channel: "${meta.channel}"
channel_id: "${meta.channelId}"
date: ${meta.uploadDate}
url: "${meta.url}"
lang: ${meta.language}
duration: "${meta.duration}"
source: manual
transcript: ${hasTranscript}
topics:
${topicsYaml}
tags: [draco, yt-summary]
---

![](${meta.url})

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
  const fileName = `${meta.uploadDate}-${sanitize(meta.title)}-逐字稿.md`;
  const filePath = join(outputDir, fileName);

  const body = transcript.segments
    .map((s) => (s.start ? `[${s.start}] ${s.text}` : s.text))
    .join("\n");

  const content = `---
type: yt-transcript
title: "${meta.title}"
channel: "${meta.channel}"
date: ${meta.uploadDate}
url: "${meta.url}"
source: ${transcript.source}
---

# ${meta.title} — 逐字稿

${body}
`;

  await writeFile(filePath, content, "utf-8");
  return filePath;
}

function sanitize(title: string): string {
  return title
    .replace(/[/\\:*?"<>|]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);
}
