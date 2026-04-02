// src/app/api/presentations/push-github/route.ts
import { mkdir, writeFile } from "fs/promises";
import { execSync } from "child_process";
import { join } from "path";
import { homedir } from "os";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SLIDES_REPO = "cyclone-tw/slides";
const SLIDES_DIR = join(homedir(), "slides-repo");

export async function POST(request: Request) {
  try {
    const { title, html, speakerNotes, folderName } = await request.json();

    if (!title || !html) {
      return Response.json({ error: "Missing title or html" }, { status: 400 });
    }

    // Use user-specified folder name, or fallback to slugified title
    const folder = folderName?.trim() || slugify(title);
    const folderPath = join(SLIDES_DIR, folder);

    // Ensure repo exists and is up to date
    try {
      execSync(`git -C "${SLIDES_DIR}" rev-parse --git-dir`, { stdio: "pipe" });
      execSync(`git -C "${SLIDES_DIR}" pull --rebase 2>/dev/null || true`, { stdio: "pipe" });
    } catch {
      try {
        execSync(`gh repo clone ${SLIDES_REPO} "${SLIDES_DIR}"`, { stdio: "pipe" });
      } catch {
        await mkdir(SLIDES_DIR, { recursive: true });
        execSync(`git -C "${SLIDES_DIR}" init`, { stdio: "pipe" });
        execSync(`gh repo create ${SLIDES_REPO} --public --source="${SLIDES_DIR}" --push`, { stdio: "pipe" });
      }
    }

    // Create presentation folder with index.html
    await mkdir(folderPath, { recursive: true });
    await writeFile(join(folderPath, "index.html"), html, "utf-8");
    if (speakerNotes) {
      await writeFile(join(folderPath, "speaker-notes.md"), speakerNotes, "utf-8");
    }

    // Git add, commit, push
    execSync(`git -C "${SLIDES_DIR}" add "${folder}"`, { stdio: "pipe" });
    execSync(
      `git -C "${SLIDES_DIR}" commit -m "Add ${folder} slide"`,
      { stdio: "pipe" },
    );
    execSync(`git -C "${SLIDES_DIR}" push`, { stdio: "pipe" });

    const pageUrl = `https://cyclone-tw.github.io/slides/${folder}/`;

    return Response.json({
      success: true,
      folder,
      repo: SLIDES_REPO,
      url: pageUrl,
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 },
    );
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
