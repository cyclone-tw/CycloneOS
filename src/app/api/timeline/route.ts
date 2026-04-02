import { type NextRequest } from "next/server";
import { execSync } from "child_process";
import { readdir } from "fs/promises";
import path from "path";
import { getRecentSessions } from "@/lib/session-reader";
import { PATHS } from "@/config/paths-config";

export const dynamic = "force-dynamic";

const REPO_ROOT = path.resolve(process.cwd(), "..");

const VAULT_PATH = PATHS.obsidianVault;

const CRON_DIRS = [
  { dir: path.join(VAULT_PATH, "Draco/cron/daily-info"), skill: "daily-info" },
  { dir: path.join(VAULT_PATH, "Draco/cron/mail-info"), skill: "mail-summary" },
  { dir: path.join(VAULT_PATH, "Draco/cron/yt-summary"), skill: "yt-monitor" },
  { dir: path.join(VAULT_PATH, "Draco/cron/weekly-info"), skill: "weekly-deep-info" },
  { dir: path.join(VAULT_PATH, "Draco/cron/weekly-review"), skill: "weekly-review" },
];

export interface TimelineEntry {
  id: string;
  date: string; // YYYY-MM-DD
  type: "dev" | "work" | "auto";
  title: string;
  description?: string;
  source: "git" | "session" | "cron";
  badge?: string; // e.g. commit type, session number, skill name
}

/** Get git commits from the repo */
function getGitCommits(days: number): TimelineEntry[] {
  try {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().slice(0, 10);

    const raw = execSync(
      `git log --since="${sinceStr}" --pretty=format:"%H|%ad|%s" --date=short`,
      { cwd: REPO_ROOT, encoding: "utf-8", timeout: 5000 }
    ).trim();

    if (!raw) return [];

    return raw.split("\n").map((line) => {
      const [hash, date, ...msgParts] = line.split("|");
      const message = msgParts.join("|");
      // Extract conventional commit type
      const typeMatch = message.match(/^(\w+)(?:\(([^)]+)\))?:\s*(.+)/);
      const commitType = typeMatch?.[1] ?? "";
      const scope = typeMatch?.[2] ?? "";
      const title = typeMatch?.[3] ?? message;
      const badge = scope ? `${commitType}(${scope})` : commitType || "commit";

      return {
        id: `git-${hash.slice(0, 8)}`,
        date,
        type: "dev" as const,
        title,
        description: message,
        source: "git" as const,
        badge,
      };
    });
  } catch {
    return [];
  }
}

/** Get cron outputs from Obsidian vault */
async function getCronOutputs(days: number): Promise<TimelineEntry[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const entries: TimelineEntry[] = [];

  for (const { dir, skill } of CRON_DIRS) {
    let files: string[];
    try {
      files = await readdir(dir);
    } catch {
      continue;
    }

    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      // Extract date from filename: 2026-03-24-daily-info.md or 2026-03-24-0600-MailReport.md
      const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})/);
      if (!dateMatch) continue;
      const date = dateMatch[1];
      if (date < cutoffStr) continue;

      entries.push({
        id: `cron-${skill}-${file}`,
        date,
        type: "auto",
        title: file.replace(/\.md$/, ""),
        source: "cron",
        badge: skill,
      });
    }
  }

  return entries;
}

export async function GET(request: NextRequest) {
  const days = Math.min(
    parseInt(request.nextUrl.searchParams.get("days") ?? "30", 10),
    90
  );

  const [gitEntries, sessions, cronEntries] = await Promise.all([
    Promise.resolve(getGitCommits(days)),
    getRecentSessions(days),
    getCronOutputs(days),
  ]);

  // Convert sessions to timeline entries
  const sessionEntries: TimelineEntry[] = sessions.map((s) => ({
    id: `session-${s.date}-${s.session}`,
    date: s.date,
    type: s.sessionType === "work" ? ("work" as const) : ("dev" as const),
    title: s.summary ?? `Session #${s.session}`,
    source: "session" as const,
    badge: s.sessionType ?? "session",
  }));

  // Combine and sort by date desc
  const all = [...gitEntries, ...sessionEntries, ...cronEntries].sort(
    (a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title)
  );

  // Group by date
  const grouped: Record<string, TimelineEntry[]> = {};
  for (const entry of all) {
    (grouped[entry.date] ??= []).push(entry);
  }

  // Stats
  const stats = {
    total: all.length,
    dev: all.filter((e) => e.type === "dev").length,
    work: all.filter((e) => e.type === "work").length,
    auto: all.filter((e) => e.type === "auto").length,
  };

  return Response.json({ grouped, stats });
}
