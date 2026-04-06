// src/app/api/presentations/push-github/route.ts
import { pushToGitHubPages, slugify } from "@/lib/github-pages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SLIDES_REPO = "cyclone-tw/slides";

export async function POST(request: Request) {
  try {
    const { title, html, speakerNotes, folderName } = await request.json();

    if (!title || !html) {
      return Response.json({ error: "Missing title or html" }, { status: 400 });
    }

    const folder = folderName?.trim() || slugify(title);
    const files = [{ name: "index.html", content: html }];
    if (speakerNotes) {
      files.push({ name: "speaker-notes.md", content: speakerNotes });
    }

    const result = await pushToGitHubPages({
      repo: SLIDES_REPO,
      folder,
      files,
      commitMessage: `Add ${folder} slide`,
    });

    return Response.json({ success: true, ...result });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 },
    );
  }
}
