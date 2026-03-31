// dashboard/src/app/api/drive/mkdir/route.ts
import { NextRequest } from "next/server";
import { getStorageProvider } from "@/lib/providers/registry";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { accountId, path: dirPath } = await request.json();

    if (!accountId || !dirPath) {
      return Response.json(
        { error: "accountId and path are required" },
        { status: 400 }
      );
    }

    const provider = getStorageProvider(accountId);
    await provider.mkdir(dirPath);

    return Response.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("traversal") || message.includes("Symlink")) {
      return Response.json({ error: "Forbidden path" }, { status: 403 });
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
