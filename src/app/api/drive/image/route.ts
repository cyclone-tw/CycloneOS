// Serve image files directly as binary (avoids base64 bloat in JSON)
import { NextRequest } from "next/server";
import { getStorageProvider } from "@/lib/providers/registry";
import { lookup } from "mime-types";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60s for cloud-only file downloads

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const accountId = searchParams.get("accountId");
  const filePath = searchParams.get("path");

  if (!accountId || !filePath) {
    return new Response("accountId and path are required", { status: 400 });
  }

  try {
    const provider = getStorageProvider(accountId);
    const buffer = await provider.readFile(filePath);
    const mimeType = lookup(filePath) || "application/octet-stream";

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("traversal") || message.includes("Symlink")) {
      return new Response("Forbidden", { status: 403 });
    }
    return new Response(message, { status: 500 });
  }
}
