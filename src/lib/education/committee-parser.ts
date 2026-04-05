import { readFile, writeFile, mkdir } from "fs/promises";
import { dirname } from "path";
import { committeePath } from "./obsidian-paths";

export interface CommitteeMember {
  order: number;
  title: string;
  name: string;
  role: string;
  note: string;
}

interface CommitteeRoster {
  year: number;
  members: CommitteeMember[];
}

export async function parseCommitteeFile(year: number): Promise<CommitteeRoster> {
  const path = committeePath(year);
  let content: string;
  try {
    content = await readFile(path, "utf-8");
  } catch {
    return { year, members: [] };
  }

  const members: CommitteeMember[] = [];
  const lines = content.split("\n");
  let inTable = false;
  let headerPassed = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) {
      if (inTable) break;
      continue;
    }

    inTable = true;

    if (!headerPassed) {
      headerPassed = true;
      continue;
    }

    if (trimmed.match(/^\|[\s-|]+\|$/)) continue;

    const cells = trimmed
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c !== "");

    if (cells.length >= 4) {
      members.push({
        order: parseInt(cells[0], 10) || members.length + 1,
        title: cells[1],
        name: cells[2],
        role: cells[3],
        note: cells[4] ?? "",
      });
    }
  }

  return { year, members };
}

export async function writeCommitteeFile(roster: CommitteeRoster): Promise<string> {
  const path = committeePath(roster.year);
  await mkdir(dirname(path), { recursive: true });

  const today = new Date();
  const rocYear = today.getFullYear() - 1911;
  const updated = `${rocYear}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const lines = [
    "---",
    "type: 特推會委員名冊",
    `academic_year: ${roster.year}`,
    `updated: "${updated}"`,
    "tags: [特推會, 委員名冊]",
    "---",
    "",
    "| 序號 | 職稱 | 姓名 | 身份 | 備註 |",
    "|------|------|------|------|------|",
  ];

  for (const m of roster.members) {
    lines.push(`| ${m.order} | ${m.title} | ${m.name} | ${m.role} | ${m.note} |`);
  }

  lines.push("");

  const content = lines.join("\n");
  await writeFile(path, content, "utf-8");
  return path;
}
