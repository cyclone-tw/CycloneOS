import { readFile } from "fs/promises";
import { homedir } from "os";
import { join } from "path";

export interface AuditEntry {
  time: string;
  tool: string;
  detail: string;
}

const AUDIT_PATH = join(homedir(), ".cyclone", "logs", "audit.jsonl");

/**
 * Read audit log entries from ~/.cyclone/logs/audit.jsonl
 * The file contains pretty-printed (multi-line) JSON objects, not one-per-line.
 */
export async function readAuditEntries(limit = 100): Promise<AuditEntry[]> {
  let raw: string;
  try {
    raw = await readFile(AUDIT_PATH, "utf-8");
  } catch {
    return [];
  }

  const trimmed = raw.trim();
  if (!trimmed) return [];

  // Split on the boundary between consecutive pretty-printed JSON objects:
  // a closing brace followed by (optional whitespace/newlines) an opening brace.
  const chunks = trimmed.split(/\}\s*\{/).map((chunk, i, arr) => {
    let s = chunk;
    if (i > 0) s = "{" + s;
    if (i < arr.length - 1) s = s + "}";
    return s;
  });

  const entries: AuditEntry[] = [];
  for (const chunk of chunks) {
    try {
      const obj = JSON.parse(chunk);
      entries.push({
        time: obj.time ?? "",
        tool: obj.tool ?? "",
        detail: obj.detail ?? "",
      });
    } catch {
      // skip malformed entries
    }
  }

  // Sort newest-first, then take the last `limit` entries
  entries.sort((a, b) => (b.time > a.time ? 1 : b.time < a.time ? -1 : 0));
  return entries.slice(0, limit);
}

/**
 * Count the number of audit operations from today (local time).
 */
export async function countTodayOps(): Promise<number> {
  const entries = await readAuditEntries(Infinity);
  const todayPrefix = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return entries.filter((e) => e.time.startsWith(todayPrefix)).length;
}
