// dashboard/src/lib/providers/local-drive.ts
import path from "path";
import fs from "fs/promises";
import { lookup } from "mime-types";
import type { DriveAccount } from "@/config/accounts";
import type { FileEntry, StorageProvider } from "./types";

/** Resolve and validate path is within account base path (prevents path traversal) */
function validatePath(account: DriveAccount, requestedPath: string): string {
  const basePath = account.localBasePath;
  const resolved = path.resolve(basePath, requestedPath);
  if (!resolved.startsWith(basePath + path.sep) && resolved !== basePath) {
    throw new Error("Path traversal detected");
  }
  return resolved;
}

/** Additional symlink check for existing paths */
async function validateExistingPath(
  account: DriveAccount,
  requestedPath: string
): Promise<string> {
  const resolved = validatePath(account, requestedPath);
  const real = await fs.realpath(resolved);
  if (!real.startsWith(account.localBasePath + path.sep) && real !== account.localBasePath) {
    throw new Error("Symlink points outside allowed directory");
  }
  return real;
}

function toFileEntry(
  name: string,
  relativePath: string,
  stat: { isDirectory: () => boolean; size: number; mtime: Date }
): FileEntry {
  return {
    name,
    path: relativePath,
    isDirectory: stat.isDirectory(),
    size: stat.size,
    modifiedAt: stat.mtime.toISOString(),
    mimeType: stat.isDirectory() ? undefined : lookup(name) || undefined,
  };
}

export class LocalDriveProvider implements StorageProvider {
  readonly id: string;
  readonly name: string;
  readonly accountEmail: string;

  constructor(private account: DriveAccount) {
    this.id = account.id;
    this.name = `Local Drive (${account.label})`;
    this.accountEmail = account.email;
  }

  async listFiles(dirPath: string): Promise<FileEntry[]> {
    const absDir = await validateExistingPath(this.account, dirPath);
    const entries = await fs.readdir(absDir, { withFileTypes: true });
    const results: FileEntry[] = [];

    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue; // skip hidden files
      const entryPath = path.join(absDir, entry.name);
      const stat = await fs.stat(entryPath);
      const relativePath = path.relative(this.account.localBasePath, entryPath);
      results.push(toFileEntry(entry.name, relativePath, stat));
    }

    return results.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name, "zh-Hant");
    });
  }

  async readFile(filePath: string, timeoutMs: number = 30000): Promise<Buffer> {
    const abs = await validateExistingPath(this.account, filePath);
    // Google Drive streaming mode: reading a cloud-only file triggers download.
    // Use AbortSignal for timeout + retry once to allow the download to complete.
    const maxAttempts = 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const signal = AbortSignal.timeout(timeoutMs);
        return await fs.readFile(abs, { signal });
      } catch (err: unknown) {
        const isTimeout =
          err instanceof Error &&
          (err.message.includes("ETIMEDOUT") ||
            err.name === "AbortError" ||
            err.message.includes("timed out"));
        if (isTimeout && attempt < maxAttempts) {
          // First attempt triggered the download; wait briefly then retry
          await new Promise((r) => setTimeout(r, 3000));
          continue;
        }
        throw err;
      }
    }
    return fs.readFile(abs); // fallback (unreachable)
  }

  async writeFile(filePath: string, content: Buffer): Promise<void> {
    const abs = validatePath(this.account, filePath);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content);
  }

  async copyFile(src: string, dest: string): Promise<void> {
    const absSrc = await validateExistingPath(this.account, src);
    const absDest = validatePath(this.account, dest);
    await fs.mkdir(path.dirname(absDest), { recursive: true });
    await fs.cp(absSrc, absDest, { recursive: true });
  }

  async moveFile(src: string, dest: string): Promise<void> {
    const absSrc = await validateExistingPath(this.account, src);
    const absDest = validatePath(this.account, dest);
    await fs.mkdir(path.dirname(absDest), { recursive: true });
    await fs.rename(absSrc, absDest);
  }

  async deleteFile(filePath: string): Promise<void> {
    const abs = await validateExistingPath(this.account, filePath);
    const stat = await fs.stat(abs);
    if (stat.isDirectory()) {
      await fs.rm(abs, { recursive: true });
    } else {
      await fs.unlink(abs);
    }
  }

  async search(query: string, dirPath: string = "."): Promise<FileEntry[]> {
    const absDir = await validateExistingPath(this.account, dirPath);
    const basePath = this.account.localBasePath;
    const results: FileEntry[] = [];
    const lowerQuery = query.toLowerCase();

    async function walk(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.name.toLowerCase().includes(lowerQuery)) {
          const stat = await fs.stat(fullPath);
          const relativePath = path.relative(basePath, fullPath);
          results.push(toFileEntry(entry.name, relativePath, stat));
        }
        if (entry.isDirectory() && results.length < 100) {
          await walk(fullPath);
        }
      }
    }

    await walk(absDir);
    return results.slice(0, 100); // cap results
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      const abs = validatePath(this.account, filePath);
      await fs.access(abs);
      return true;
    } catch {
      return false;
    }
  }

  async mkdir(dirPath: string): Promise<void> {
    const abs = validatePath(this.account, dirPath);
    await fs.mkdir(abs, { recursive: true });
  }
}
