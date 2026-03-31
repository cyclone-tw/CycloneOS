// dashboard/src/app/api/drive/list/route.ts
import { NextRequest } from "next/server";
import { getStorageProvider } from "@/lib/providers/registry";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const accountId = searchParams.get("accountId");
  const dirPath = searchParams.get("path") ?? ".";

  if (!accountId) {
    return Response.json({ error: "accountId is required" }, { status: 400 });
  }

  try {
    const provider = getStorageProvider(accountId);
    const files = await provider.listFiles(dirPath);
    return Response.json({ files });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("traversal") || message.includes("Symlink")) {
      return Response.json({ error: "Forbidden path" }, { status: 403 });
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
