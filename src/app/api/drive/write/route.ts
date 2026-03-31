// dashboard/src/app/api/drive/write/route.ts
import { NextRequest } from "next/server";
import { getStorageProvider } from "@/lib/providers/registry";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const accountId = formData.get("accountId") as string;
    const filePath = formData.get("path") as string;
    const file = formData.get("file") as File | null;

    if (!accountId || !filePath || !file) {
      return Response.json(
        { error: "accountId, path, and file are required" },
        { status: 400 }
      );
    }

    const provider = getStorageProvider(accountId);
    const buffer = Buffer.from(await file.arrayBuffer());
    await provider.writeFile(filePath, buffer);

    return Response.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("traversal") || message.includes("Symlink")) {
      return Response.json({ error: "Forbidden path" }, { status: 403 });
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
