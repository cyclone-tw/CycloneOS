// dashboard/src/app/api/drive/delete/route.ts
import { NextRequest } from "next/server";
import { getStorageProvider } from "@/lib/providers/registry";

export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const accountId = searchParams.get("accountId");
  const filePath = searchParams.get("path");

  if (!accountId || !filePath) {
    return Response.json(
      { error: "accountId and path are required" },
      { status: 400 }
    );
  }

  try {
    const provider = getStorageProvider(accountId);
    await provider.deleteFile(filePath);
    return Response.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("traversal") || message.includes("Symlink")) {
      return Response.json({ error: "Forbidden path" }, { status: 403 });
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
