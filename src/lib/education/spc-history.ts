import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { OBSIDIAN_PATHS } from "./obsidian-paths";

export interface SpcHistoryRecord {
  filename: string;
  date: string;
  topic: string;
  excerpt: string;
  academicYear: number;
  meetingNumber: number;
}

export async function fetchSimilarMeetings(
  topicKeyword: string,
  limit = 5
): Promise<SpcHistoryRecord[]> {
  const dir = OBSIDIAN_PATHS.spcMeeting;
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }

  const mdFiles = files
    .filter((f) => f.endsWith(".md") && !f.startsWith("moc-"))
    .sort()
    .reverse();

  const records: SpcHistoryRecord[] = [];

  for (const file of mdFiles) {
    if (records.length >= limit) break;

    const content = await readFile(join(dir, file), "utf-8");
    const frontmatter = parseFrontmatter(content);

    const topics: string[] = frontmatter.topics ?? [];
    const matchesTopic =
      topics.some((t: string) => t.includes(topicKeyword)) ||
      file.includes(topicKeyword);

    if (!matchesTopic) continue;

    const excerpt = extractProposalExcerpt(content, topicKeyword);

    records.push({
      filename: file.replace(".md", ""),
      date: frontmatter.date ?? "",
      topic: topics.join("、") || file.replace(/^\d+-特推會-\d+-/, "").replace(".md", ""),
      excerpt,
      academicYear: frontmatter.academic_year ?? 0,
      meetingNumber: frontmatter.meeting_number ?? 0,
    });
  }

  return records;
}

export async function fetchPreviousDecisions(
  academicYear: number,
  meetingNumber: number
): Promise<string> {
  if (meetingNumber <= 1) return "";

  const dir = OBSIDIAN_PATHS.spcMeeting;
  const prevNum = String(meetingNumber - 1).padStart(2, "0");
  const prefix = `${academicYear}-特推會-${prevNum}-`;

  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return "";
  }

  const prevFile = files.find((f) => f.startsWith(prefix) && f.endsWith(".md"));
  if (!prevFile) return "";

  const content = await readFile(join(dir, prevFile), "utf-8");
  const frontmatter = parseFrontmatter(content);
  const decisions: string[] = frontmatter.decisions ?? [];

  return decisions.join("\n");
}

function parseFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const yaml = match[1];
  const result: Record<string, unknown> = {};

  for (const line of yaml.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value: string | number | string[] = line.slice(colonIdx + 1).trim();

    if (value.startsWith("[") && value.endsWith("]")) {
      result[key] = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""));
      continue;
    }

    value = value.replace(/^["']|["']$/g, "");

    const num = Number(value);
    result[key] = isNaN(num) || value === "" ? value : num;
  }

  return result;
}

function extractProposalExcerpt(content: string, keyword: string): string {
  const lines = content.split("\n");
  let capturing = false;
  const excerptLines: string[] = [];

  for (const line of lines) {
    if (line.includes("說明") && (line.includes("【") || line.includes("**"))) {
      capturing = true;
      continue;
    }
    if (capturing) {
      if (line.startsWith("【") || line.startsWith("**決議") || line.trim() === "") {
        if (excerptLines.length > 0) break;
        continue;
      }
      excerptLines.push(line.trim());
      if (excerptLines.length >= 3) break;
    }
  }

  return excerptLines.join(" ").slice(0, 200);
}
