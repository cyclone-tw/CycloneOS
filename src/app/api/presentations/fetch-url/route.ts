// src/app/api/presentations/fetch-url/route.ts

import { NextRequest } from "next/server";
import { feloWebFetch } from "@/lib/felo/web-fetch";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEBFETCH_DIR = join(process.cwd(), "public/uploads/felo/web-fetch");

export async function POST(req: NextRequest) {
  const { url } = await req.json();

  if (!url || typeof url !== "string") {
    return Response.json({ error: "url is required" }, { status: 400 });
  }

  try {
    new URL(url);
  } catch {
    return Response.json({ error: "Invalid URL format" }, { status: 400 });
  }

  try {
    const content = await feloWebFetch(url, {
      outputFormat: "markdown",
      withReadability: true,
      crawlMode: "fast",
    });

    if (!content) {
      return Response.json(
        { error: "Empty content from URL" },
        { status: 502 },
      );
    }

    const timestamp = Date.now();
    const slug = new URL(url).hostname.replace(/\./g, "-");
    const filename = `${slug}-${timestamp}.md`;

    await mkdir(WEBFETCH_DIR, { recursive: true });
    await writeFile(join(WEBFETCH_DIR, filename), content, "utf-8");

    const localPath = `/uploads/felo/web-fetch/${filename}`;

    return Response.json({
      content,
      localPath,
      sourceUrl: url,
      createdAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[fetch-url] error:", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "URL fetch failed" },
      { status: 500 },
    );
  }
}
