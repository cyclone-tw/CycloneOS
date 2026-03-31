// dashboard/src/app/api/documents/browse/route.ts
import { NextRequest } from "next/server";
import { readdir, stat } from "fs/promises";
import { join, resolve } from "path";
import { homedir } from "os";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function expandHome(p: string): string {
  if (p.startsWith("~/") || p === "~") return join(homedir(), p.slice(1));
  return p;
}

export async function GET(request: NextRequest) {
  const dirPath = request.nextUrl.searchParams.get("path") ?? "~";
  const absPath = resolve(expandHome(dirPath));

  // Security: block common dangerous paths
  const blocked = ["/etc", "/var", "/usr", "/bin", "/sbin", "/System", "/private"];
  if (blocked.some((b) => absPath.startsWith(b))) {
    return Response.json({ error: "Forbidden path" }, { status: 403 });
  }

  try {
    const entries = await readdir(absPath, { withFileTypes: true });
    const items = await Promise.all(
      entries
        .filter((e) => !e.name.startsWith("."))
        .map(async (e) => {
          const fullPath = join(absPath, e.name);
          try {
            const s = await stat(fullPath);
            return {
              name: e.name,
              path: fullPath,
              isDirectory: e.isDirectory(),
              size: s.size,
              modifiedAt: s.mtime.toISOString(),
            };
          } catch {
            return null;
          }
        })
    );

    const filtered = items.filter(Boolean);
    filtered.sort((a, b) => {
      if (a!.isDirectory !== b!.isDirectory) return a!.isDirectory ? -1 : 1;
      return a!.name.localeCompare(b!.name);
    });

    return Response.json({
      path: absPath,
      parent: resolve(absPath, ".."),
      items: filtered,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
