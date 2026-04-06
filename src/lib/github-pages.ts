// src/lib/github-pages.ts
import { mkdir, writeFile } from "fs/promises";
import { execSync } from "child_process";
import { join } from "path";
import { homedir } from "os";

export interface GitHubPagesFile {
  name: string;
  content: string;
}

export interface PushOptions {
  repo: string;
  folder: string;
  files: GitHubPagesFile[];
  commitMessage: string;
  localDir?: string;
}

export interface PushResult {
  url: string;
  folder: string;
  repo: string;
}

/**
 * Push files to a GitHub Pages repo.
 * Handles clone/init, file writing, commit, and push.
 */
export async function pushToGitHubPages(options: PushOptions): Promise<PushResult> {
  const { repo, folder, files, commitMessage } = options;
  const repoName = repo.split("/").pop() ?? "repo";
  const localDir = options.localDir ?? join(homedir(), `${repoName}-repo`);
  const folderPath = join(localDir, folder);

  // Ensure repo exists and is up to date
  try {
    execSync(`git -C "${localDir}" rev-parse --git-dir`, { stdio: "pipe" });
    execSync(`git -C "${localDir}" pull --rebase 2>/dev/null || true`, { stdio: "pipe" });
  } catch {
    try {
      execSync(`gh repo clone ${repo} "${localDir}"`, { stdio: "pipe" });
    } catch {
      await mkdir(localDir, { recursive: true });
      execSync(`git -C "${localDir}" init`, { stdio: "pipe" });
      execSync(`gh repo create ${repo} --public --source="${localDir}" --push`, { stdio: "pipe" });
    }
  }

  // Write files
  await mkdir(folderPath, { recursive: true });
  for (const file of files) {
    await writeFile(join(folderPath, file.name), file.content, "utf-8");
  }

  // Git add, commit, push
  execSync(`git -C "${localDir}" add "${folder}"`, { stdio: "pipe" });
  execSync(
    `git -C "${localDir}" commit -m "${commitMessage.replace(/"/g, '\\"')}"`,
    { stdio: "pipe" },
  );
  execSync(`git -C "${localDir}" push`, { stdio: "pipe" });

  const orgName = repo.split("/")[0];
  const repoBaseName = repo.split("/")[1];
  const url = `https://${orgName}.github.io/${repoBaseName}/${folder}/`;

  return { url, folder, repo };
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
