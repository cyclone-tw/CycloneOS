import { spawn } from "child_process";
import { join } from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SCRIPT_PATH = join(process.cwd(), "scripts/education/spc_meeting_core.py");

interface DraftRequest {
  proposalType: string;
  students: { name: string; className: string; disability: string; detail?: string }[];
  refDoc: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DraftRequest;

    if (!body.proposalType) {
      return Response.json({ error: "Missing proposalType" }, { status: 400 });
    }

    const input = JSON.stringify({
      action: "draft",
      proposal_type: body.proposalType,
      students: body.students,
      ref_doc: body.refDoc,
    });

    const result = await runPython(SCRIPT_PATH, ["--json"], input);
    const parsed = JSON.parse(result);

    return Response.json({ title: parsed.title, description: parsed.description });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

function runPython(script: string, args: string[], stdin: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("python3", [script, ...args], {
      stdio: ["pipe", "pipe", "pipe"],
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
