// dashboard/src/app/api/drive/search/route.ts
import { NextRequest } from "next/server";
import { getStorageProvider } from "@/lib/providers/registry";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const accountId = searchParams.get("accountId");
  const query = searchParams.get("query");
  const dirPath = searchParams.get("path") ?? ".";

  if (!accountId || !query) {
    return Response.json(
      { error: "accountId and query are required" },
      { status: 400 }
    );
  }

  try {
    const provider = getStorageProvider(accountId);
    const files = await provider.search(query, dirPath);
    return Response.json({ files });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("traversal") || message.includes("Symlink")) {
      return Response.json({ error: "Forbidden path" }, { status: 403 });
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
