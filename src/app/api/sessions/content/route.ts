import { type NextRequest } from "next/server";
import { readFile } from "fs/promises";
import { PATHS } from "@/config/paths-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VAULT_PATH = PATHS.obsidianVault;

const ALLOWED_PREFIXES = [
  `${VAULT_PATH}/CycloneOS/sessions/`,
  `${VAULT_PATH}/Draco/01.OpenClaw/Claude session-logs/`,
];

export async function GET(request: NextRequest) {
  const filePath = request.nextUrl.searchParams.get("path");

  if (!filePath) {
    return Response.json({ error: "Missing path parameter" }, { status: 400 });
  }

  // Security: only allow reading files under session directories
  const allowed = ALLOWED_PREFIXES.some((prefix) =>
    filePath.startsWith(prefix)
  );
  if (!allowed) {
    return Response.json({ error: "Access denied" }, { status: 403 });
  }

  try {
    const content = await readFile(filePath, "utf-8");
    return Response.json({ content });
  } catch {
    return Response.json({ error: "File not found" }, { status: 404 });
  }
}
