import { readdir } from "fs/promises";
import path from "path";

const VAULT_PATH =
  "/Users/username/Library/CloudStorage/GoogleDrive-user@gmail.com/我的雲端硬碟/Obsidian-Cyclone";
const CRON_DIR = path.join(VAULT_PATH, "Draco", "cron");

export interface CronOutput {
  name: string;
  category: string;
  date: string;
  path: string;
}

/**
 * Parse a YYYY-MM-DD date prefix from a filename.
 * Returns the date string or null if not found.
 */
function parseDatePrefix(filename: string): string | null {
  const match = filename.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

/**
 * Scan each subdirectory under Draco/cron/ and return recent outputs.
 */
export async function getRecentCronOutputs(
  days: number = 3
): Promise<CronOutput[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);

  const results: CronOutput[] = [];

  let categories: string[];
  try {
    const entries = await readdir(CRON_DIR, { withFileTypes: true });
    categories = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    // Cron directory doesn't exist or isn't accessible
    return [];
  }

  for (const category of categories) {
    const categoryDir = path.join(CRON_DIR, category);
    let files: string[];
    try {
      files = await readdir(categoryDir);
    } catch {
      continue;
    }

    for (const file of files) {
      const dateStr = parseDatePrefix(file);
      if (!dateStr) continue;

      const fileDate = new Date(dateStr + "T00:00:00");
      if (fileDate < cutoff) continue;

      results.push({
        name: file,
        category,
        date: dateStr,
        path: path.join(categoryDir, file),
      });
    }
  }

  // Sort newest first
  results.sort((a, b) => b.date.localeCompare(a.date));

  return results;
}

/**
 * Return the count of today's cron outputs.
 */
export async function getTodayCronCount(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const outputs = await getRecentCronOutputs(1);
  return outputs.filter((o) => o.date === today).length;
}
