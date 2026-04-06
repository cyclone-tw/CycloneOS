// src/app/api/social/upload-image/route.ts
// POST /api/social/upload-image
// Accepts multipart form data with one or more "images" fields.
// Saves files to public/uploads/social/YYYY-MM-DD/ and returns URLs.

import { writeFile, mkdir } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    const formData = await request.formData();
    const files = formData.getAll("images") as File[];

    if (!files || files.length === 0) {
      return Response.json({ error: "No images provided" }, { status: 400 });
    }

    // Build date-based upload directory: public/uploads/social/YYYY-MM-DD/
    const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
    const uploadDir = path.join(process.cwd(), "public", "uploads", "social", today);
    await mkdir(uploadDir, { recursive: true });

    const urls: string[] = [];

    for (const file of files) {
      if (!(file instanceof File)) continue;

      const ext = path.extname(file.name) || ".jpg";
      const id = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
      const filename = `${id}${ext}`;
      const filePath = path.join(uploadDir, filename);

      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(filePath, buffer);

      urls.push(`/uploads/social/${today}/${filename}`);
    }

    if (urls.length === 0) {
      return Response.json({ error: "No valid files were processed" }, { status: 400 });
    }

    return Response.json({ urls });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[upload-image] Error:", msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
