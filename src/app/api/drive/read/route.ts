// dashboard/src/app/api/drive/read/route.ts
import { NextRequest } from "next/server";
import { getStorageProvider } from "@/lib/providers/registry";
import { lookup } from "mime-types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const accountId = searchParams.get("accountId");
  const filePath = searchParams.get("path");

  if (!accountId || !filePath) {
    return Response.json(
      { error: "accountId and path are required" },
      { status: 400 }
    );
  }

  const mimeType = lookup(filePath) || "application/octet-stream";

  // For known binary formats, skip readFile entirely — return metadata only
  const binaryMimes = [
    "application/vnd.openxmlformats",
    "application/msword",
    "application/vnd.ms-",
    "application/pdf",
    "application/zip",
    "application/x-rar",
    "application/x-7z",
  ];
  if (binaryMimes.some((prefix) => mimeType.startsWith(prefix))) {
    return Response.json({
      mimeType,
      binary: true,
      message: "此檔案為二進制格式，無法在瀏覽器中預覽",
      downloadHint: filePath,
    });
  }

  try {
    const provider = getStorageProvider(accountId);
    const buffer = await provider.readFile(filePath);

    // For text-based files, return as text
    if (mimeType.startsWith("text/") || mimeType === "application/json" || mimeType === "application/javascript") {
      return Response.json({ content: buffer.toString("utf-8"), mimeType });
    }

    // For images, return base64
    if (mimeType.startsWith("image/")) {
      return Response.json({
        content: buffer.toString("base64"),
        mimeType,
        encoding: "base64",
      });
    }

    // For other files, return metadata only
    return Response.json({
      mimeType,
      size: buffer.length,
      downloadHint: "Use the file path directly for large binary files",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("traversal") || message.includes("Symlink")) {
      return Response.json({ error: "Forbidden path" }, { status: 403 });
    }
    const isTimeout =
      message.includes("ETIMEDOUT") ||
      message.includes("timed out") ||
      message.includes("AbortError");
    if (isTimeout) {
      return Response.json(
        { error: "cloud_timeout", message: "檔案正在從雲端下載，請稍後重試" },
        { status: 504 }
      );
    }
    // Graceful fallback for unreadable files (e.g. binary files with unknown mime)
    return Response.json({
      error: "unreadable",
      mimeType,
      message: "無法讀取此檔案內容",
      downloadHint: filePath,
    }, { status: 200 });
  }
}
