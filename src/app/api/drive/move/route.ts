// dashboard/src/app/api/drive/move/route.ts
import { NextRequest } from "next/server";
import { getStorageProvider } from "@/lib/providers/registry";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { srcAccount, srcPath, destAccount, destPath } =
      await request.json();

    if (!srcAccount || !srcPath || !destAccount || !destPath) {
      return Response.json(
        { error: "srcAccount, srcPath, destAccount, destPath are required" },
        { status: 400 }
      );
    }

    const srcProvider = getStorageProvider(srcAccount);

    if (srcAccount === destAccount) {
      await srcProvider.moveFile(srcPath, destPath);
    } else {
      // Cross-account: copy then delete
      const buffer = await srcProvider.readFile(srcPath);
      const destProvider = getStorageProvider(destAccount);
      await destProvider.writeFile(destPath, buffer);
      await srcProvider.deleteFile(srcPath);
    }

    return Response.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("traversal") || message.includes("Symlink")) {
      return Response.json({ error: "Forbidden path" }, { status: 403 });
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
