import { type NextRequest } from "next/server";
import { readFile } from "fs/promises";
import { PATHS } from "@/config/paths-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VAULT_PATH = PATHS.obsidianVault;
const ALLOWED_PREFIX = `${VAULT_PATH}/Draco/cron/`;

export async function GET(request: NextRequest) {
  const filePath = request.nextUrl.searchParams.get("path");

  if (!filePath) {
    return Response.json({ error: "Missing path parameter" }, { status: 400 });
  }

  // Security: only allow reading files under Draco/cron/
  if (!filePath.startsWith(ALLOWED_PREFIX)) {
    return Response.json({ error: "Access denied" }, { status: 403 });
  }

  try {
    const content = await readFile(filePath, "utf-8");
    return Response.json({ content });
  } catch {
    return Response.json({ error: "File not found" }, { status: 404 });
  }
}
