import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

const UPLOAD_DIR = "/tmp/cycloneos-uploads";
const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

/** Delete uploaded temp files older than MAX_AGE_MS */
function cleanupOldFiles() {
  try {
    if (!fs.existsSync(UPLOAD_DIR)) return;
    const now = Date.now();
    for (const name of fs.readdirSync(UPLOAD_DIR)) {
      const filePath = path.join(UPLOAD_DIR, name);
      const stat = fs.statSync(filePath);
      if (now - stat.mtimeMs > MAX_AGE_MS) {
        fs.unlinkSync(filePath);
      }
    }
  } catch {
    // Best-effort cleanup — don't fail the request
  }
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const files = formData.getAll("files") as File[];

  if (files.length === 0) {
    return Response.json({ error: "No files provided" }, { status: 400 });
  }

  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  // Clean up old temp files on each upload
  cleanupOldFiles();

  const results: Array<{ path: string; name: string; size: number; mimeType: string }> = [];

  for (const file of files) {
    const ext = file.name.split(".").pop() || "bin";
    const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const filePath = path.join(UPLOAD_DIR, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    results.push({
      path: filePath,
      name: file.name,
      size: buffer.length,
      mimeType: file.type || "application/octet-stream",
    });
  }

  return Response.json({ files: results });
}
