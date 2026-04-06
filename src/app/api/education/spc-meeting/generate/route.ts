// src/app/api/education/spc-meeting/generate/route.ts
import { spawn } from "child_process";
import { join } from "path";
import { readFile } from "fs/promises";
import { homedir } from "os";
import { pushToGitHubPages } from "@/lib/github-pages";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SCRIPT_PATH = join(process.cwd(), "scripts/education/spc_meeting_core.py");
const MEETINGS_REPO = "cyclone-tw/meetings";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action ?? "generate";

    if (!body.academicYear || !body.meetingNumber || !body.proposals?.length) {
      return Response.json({ error: "Missing required meeting data" }, { status: 400 });
    }

    const input = JSON.stringify({
      action,
      ...body,
    });

    const result = await runPython(SCRIPT_PATH, ["--json"], input);
    const parsed = JSON.parse(result);

    // Push HTML to GitHub Pages if requested and content available
    let htmlUrl: string | undefined;
    if (parsed.html_content && body.pushToGitHub) {
      try {
        const year = body.academicYear;
        const num = String(body.meetingNumber).padStart(2, "0");
        const folder = `spc/${year}-${num}`;

        const pushResult = await pushToGitHubPages({
          repo: MEETINGS_REPO,
          folder,
          files: [{ name: "index.html", content: parsed.html_content }],
          commitMessage: `Add SPC meeting ${year}-${num} agenda`,
        });
        htmlUrl = pushResult.url;
      } catch (e) {
        console.error("GitHub Pages push failed:", e);
      }
    }

    if (parsed.docx_path) {
      const docxBuffer = await readFile(parsed.docx_path);
      const filename = parsed.docx_path.split("/").pop() ?? "meeting.docx";

      return new Response(docxBuffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
          "X-Md-Path": parsed.md_path ?? "",
          "X-Moc-Updated": parsed.moc_updated ? "true" : "false",
          ...(htmlUrl ? { "X-Html-Url": htmlUrl } : {}),
        },
      });
    }

    return Response.json(parsed);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

function runPython(script: string, args: string[], stdin: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("python3", [script, ...args], {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: process.cwd(),
      env: { ...process.env, HOME: homedir() },
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data: Buffer) => { stdout += data.toString(); });
    proc.stderr.on("data", (data: Buffer) => { stderr += data.toString(); });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`Python script exited with code ${code}: ${stderr}`));
      }
    });

    proc.on("error", reject);

    proc.stdin.write(stdin);
    proc.stdin.end();
  });
}
