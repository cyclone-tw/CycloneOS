import { readdir, readFile } from "fs/promises";
import path from "path";
import { PATHS } from "@/config/paths-config";

export const dynamic = "force-dynamic";

const VAULT_PATH = PATHS.obsidianVault;
const CRON_DIR = path.join(VAULT_PATH, "Draco", "cron");

interface DigestLink {
  topic: string;
  title: string;
  source: string;
  description: string;
  url: string;
}

interface MailCategory {
  label: string;
  count: number;
  items: string[];
}

interface YtEntry {
  title: string;
  channel: string;
  url: string;
  date: string;
  topics: string[];
}

interface DigestResponse {
  dailyInfo: {
    date: string;
    links: DigestLink[];
  } | null;
  mailReport: {
    date: string;
    time: string;
    unreadCount: number;
    actionRequired: number;
    categories: MailCategory[];
  } | null;
  weeklyReview: {
    date: string;
    week: string;
    highlights: string[];
    path: string;
  } | null;
  ytSummaries: YtEntry[];
}

/** Find the most recent file in a category dir */
async function getLatestFile(
  category: string,
  prefix?: string
): Promise<{ name: string; content: string } | null> {
  const dir = path.join(CRON_DIR, category);
  try {
    const files = await readdir(dir);
    const filtered = prefix
      ? files.filter((f) => f.includes(prefix))
      : files;
    filtered.sort((a, b) => b.localeCompare(a)); // newest first
    if (filtered.length === 0) return null;
    const content = await readFile(path.join(dir, filtered[0]), "utf-8");
    return { name: filtered[0], content };
  } catch {
    return null;
  }
}

/** Get recent files from a category dir (last N days) */
async function getRecentFiles(
  category: string,
  days: number = 3
): Promise<{ name: string; content: string }[]> {
  const dir = path.join(CRON_DIR, category);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  try {
    const files = await readdir(dir);
    const recent = files
      .filter((f) => {
        const dateMatch = f.match(/^(\d{4}-\d{2}-\d{2})/);
        return dateMatch && dateMatch[1] >= cutoffStr;
      })
      .sort((a, b) => b.localeCompare(a));

    const results: { name: string; content: string }[] = [];
    for (const file of recent) {
      const content = await readFile(path.join(dir, file), "utf-8");
      results.push({ name: file, content });
    }
    return results;
  } catch {
    return [];
  }
}

/** Parse YAML frontmatter (simple key: value) */
function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    // Remove quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    fm[key] = val;
  }
  return fm;
}

/** Extract links from daily-info format: - 【Topic】Title | Source | Description | URL */
function parseDailyInfoLinks(content: string): DigestLink[] {
  const links: DigestLink[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const match = line.match(
      /^-\s*【(.+?)】(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(https?:\/\/\S+)/
    );
    if (match) {
      links.push({
        topic: match[1],
        title: match[2].trim(),
        source: match[3].trim(),
        description: match[4].trim(),
        url: match[5].trim(),
      });
    }
  }
  return links;
}

/** Parse mail report categories */
function parseMailCategories(content: string): MailCategory[] {
  const categories: MailCategory[] = [];
  const lines = content.split("\n");
  let currentCategory: MailCategory | null = null;

  for (const line of lines) {
    // Match ## Category (N 封)
    const catMatch = line.match(/^##\s+(.+?)\s*\((\d+)\s*封\)/);
    if (catMatch) {
      if (currentCategory) categories.push(currentCategory);
      currentCategory = {
        label: catMatch[1],
        count: parseInt(catMatch[2]),
        items: [],
      };
      continue;
    }
    // Match - item
    if (currentCategory && line.startsWith("- ")) {
      currentCategory.items.push(line.slice(2).trim());
    }
  }
  if (currentCategory) categories.push(currentCategory);
  return categories;
}

/** Extract key highlights from weekly review */
function parseWeeklyHighlights(content: string): string[] {
  const highlights: string[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    // Grab action items and key bullet points
    if (line.match(/^- \[[ x]\] /)) {
      highlights.push(line.replace(/^- \[[ x]\] /, "").trim());
    }
  }
  return highlights.slice(0, 8); // cap at 8
}

/** Parse YT summary frontmatter into entry */
function parseYtEntry(content: string): YtEntry | null {
  const fm = parseFrontmatter(content);
  if (!fm.title || !fm.url) return null;
  // Parse topics array from frontmatter
  const topicsMatch = content.match(/^topics:\s*\n((?:\s+-\s*".+"\n?)*)/m);
  const topics: string[] = [];
  if (topicsMatch) {
    for (const m of topicsMatch[1].matchAll(/- "(.+?)"/g)) {
      topics.push(m[1]);
    }
  }
  return {
    title: fm.title,
    channel: fm.channel ?? "",
    url: fm.url,
    date: fm.date ?? "",
    topics,
  };
}

export async function GET() {
  const result: DigestResponse = {
    dailyInfo: null,
    mailReport: null,
    weeklyReview: null,
    ytSummaries: [],
  };

  // Daily info
  const daily = await getLatestFile("daily-info");
  if (daily) {
    const fm = parseFrontmatter(daily.content);
    result.dailyInfo = {
      date: fm.date ?? "",
      links: parseDailyInfoLinks(daily.content),
    };
  }

  // Mail report (latest)
  const mail = await getLatestFile("mail-info", "MailReport");
  if (mail) {
    const fm = parseFrontmatter(mail.content);
    result.mailReport = {
      date: fm.date ?? "",
      time: fm.time ?? "",
      unreadCount: parseInt(fm.unread_count ?? "0"),
      actionRequired: parseInt(fm.action_required ?? "0"),
      categories: parseMailCategories(mail.content),
    };
  }

  // Weekly review (latest)
  const weekly = await getLatestFile("weekly-review");
  if (weekly) {
    const fm = parseFrontmatter(weekly.content);
    result.weeklyReview = {
      date: fm.date ?? "",
      week: fm.week ?? "",
      highlights: parseWeeklyHighlights(weekly.content),
      path: path.join(CRON_DIR, "weekly-review", weekly.name),
    };
  }

  // YT summaries (recent 3 days)
  const ytFiles = await getRecentFiles("yt-summary", 3);
  for (const file of ytFiles) {
    const entry = parseYtEntry(file.content);
    if (entry) result.ytSummaries.push(entry);
  }

  return Response.json(result);
}
