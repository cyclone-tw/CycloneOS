// dashboard/src/app/api/presentations/push-github/route.ts
import { mkdir, writeFile } from "fs/promises";
import { execSync } from "child_process";
import { join } from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRESENTATIONS_REPO = process.env.PRESENTATIONS_REPO || "CyclonePresentations";
const PRESENTATIONS_DIR = process.env.PRESENTATIONS_DIR || join(process.env.HOME || "/tmp", "CyclonePresentations");

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function POST(request: Request) {
  try {
    const { title, html, speakerNotes } = await request.json();

    if (!title || !html) {
      return Response.json({ error: "Missing title or html" }, { status: 400 });
    }

    const date = new Date().toISOString().slice(0, 10);
    const folderName = `${date}-${slugify(title)}`;
    const folderPath = join(PRESENTATIONS_DIR, folderName);

    // Ensure repo exists and is up to date
    try {
      execSync(`git -C "${PRESENTATIONS_DIR}" rev-parse --git-dir`, { stdio: "pipe" });
      execSync(`git -C "${PRESENTATIONS_DIR}" pull --rebase 2>/dev/null || true`, { stdio: "pipe" });
    } catch {
      // Clone or init repo
      try {
        execSync(`gh repo clone ${PRESENTATIONS_REPO} "${PRESENTATIONS_DIR}"`, { stdio: "pipe" });
      } catch {
        await mkdir(PRESENTATIONS_DIR, { recursive: true });
        execSync(`git -C "${PRESENTATIONS_DIR}" init`, { stdio: "pipe" });
        execSync(`gh repo create ${PRESENTATIONS_REPO} --private --source="${PRESENTATIONS_DIR}" --push`, { stdio: "pipe" });
      }
    }

    // Create presentation folder and files
    await mkdir(folderPath, { recursive: true });
    await writeFile(join(folderPath, "index.html"), html, "utf-8");
    await writeFile(join(folderPath, "speaker-notes.md"), speakerNotes, "utf-8");

    // Git add, commit, push
    execSync(`git -C "${PRESENTATIONS_DIR}" add "${folderName}"`, { stdio: "pipe" });
    execSync(
      `git -C "${PRESENTATIONS_DIR}" commit -m "add: ${title}"`,
      { stdio: "pipe" },
    );
    execSync(`git -C "${PRESENTATIONS_DIR}" push`, { stdio: "pipe" });

    return Response.json({
      success: true,
      path: folderName,
      repo: PRESENTATIONS_REPO,
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 },
    );
  }
}
