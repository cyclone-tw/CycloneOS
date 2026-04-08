// src/config/paths-config.ts
//
// 統一管理所有輸出路徑和檔名規則。改路徑只改這裡。
// Google Drive 路徑在所有機器上一致，適合跨裝置同步。
// Obsidian vault 用於 Markdown 輸出，方便搜尋和連結。

import { join } from "path";
import { homedir } from "os";

// --- Google Drive 根目錄 ---
const GDRIVE_EMAIL = process.env.GOOGLE_DRIVE_EMAIL_PERSONAL || "user@gmail.com";
const GOOGLE_DRIVE_ROOT = join(
  homedir(),
  `Library/CloudStorage/GoogleDrive-${GDRIVE_EMAIL}/我的雲端硬碟`,
);

// --- CycloneOS 雲端資料夾 ---
const CYCLONEOS_CLOUD = join(GOOGLE_DRIVE_ROOT, "CycloneOS");

// --- Obsidian Vault ---
const OBSIDIAN_VAULT = join(GOOGLE_DRIVE_ROOT, "Obsidian-Cyclone");
const OBSIDIAN_OUTPUTS = join(OBSIDIAN_VAULT, "CycloneOS/outputs");

// --- 輸出路徑 ---
export const PATHS = {
  // 圖片（Felo 生圖等）
  images: join(CYCLONEOS_CLOUD, "images"),

  // 二進位文件（DOCX, XLSX — 不適合 Obsidian 的格式）
  documents: join(CYCLONEOS_CLOUD, "documents"),

  // 簡報
  slides: join(CYCLONEOS_CLOUD, "slides"),

  // Markdown 輸出（所有 skill 共用，存到 Obsidian）
  markdownOutputs: OBSIDIAN_OUTPUTS,

  // YouTube 筆記（yt-notes pipeline 輸出）
  ytNotes: join(OBSIDIAN_VAULT, "Draco/yt-notes"),

  // Google Drive 根（供其他用途）
  googleDrive: GOOGLE_DRIVE_ROOT,
  cycloneosCloud: CYCLONEOS_CLOUD,
  obsidianVault: OBSIDIAN_VAULT,
} as const;

// --- GitHub 簡報 Repo ---
export const SLIDES_REPO = "cyclone-tw/slides";

// --- Symlink 對應（Next.js 靜態檔案） ---
// public/uploads/felo → CYCLONEOS_CLOUD
// 前端用 /uploads/felo/images/xxx.png 存取
export const UPLOADS_BASE = join(process.cwd(), "public/uploads/felo");

// --- 檔名產生 ---

export type OutputSource = "felo" | "research" | "webfetch" | "doc";

/**
 * 產生統一格式的輸出檔名：YYYY-MM-DD-{source}-{summary}.md
 *
 * @param source  來源代碼：felo | research | webfetch | doc
 * @param summary 摘要文字（會自動清理特殊字元、截斷）
 * @param ext     副檔名（預設 "md"）
 */
export function generateFileName(
  source: OutputSource,
  summary: string,
  ext = "md",
): string {
  const date = new Date().toISOString().slice(0, 10);
  const clean = sanitizeSummary(summary);
  return `${date}-${source}-${clean}.${ext}`;
}

/**
 * 從內容自動擷取摘要，用於檔名。
 *
 * 優先順序：
 * 1. 第一個 # 標題
 * 2. 前 30 個字（去掉特殊符號）
 */
export function extractSummary(content: string): string {
  // 嘗試取第一個 markdown 標題
  const headingMatch = content.match(/^#{1,3}\s+(.+)$/m);
  if (headingMatch) {
    return headingMatch[1].trim();
  }

  // 沒有標題，取前 30 個有意義的字
  const firstLine = content
    .split("\n")
    .find((line) => line.trim() && !line.startsWith("---") && !line.startsWith("_"));
  return firstLine?.trim().slice(0, 30) || "untitled";
}

/**
 * 從 URL 產生摘要，用於 webfetch 檔名。
 * 例：https://zh.wikipedia.org/wiki/融合教育 → 維基百科-融合教育
 */
export function extractUrlSummary(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname
      .replace("www.", "")
      .replace(".com", "")
      .replace(".org", "")
      .replace(".tw", "");

    // 取 pathname 最後一段有意義的部分
    const pathParts = u.pathname.split("/").filter(Boolean);
    const lastPart = pathParts[pathParts.length - 1] || "";
    const decoded = decodeURIComponent(lastPart).replace(/_/g, "-");

    if (decoded) {
      return `${host}-${decoded}`;
    }
    return host;
  } catch {
    return "webpage";
  }
}

// --- 內部工具 ---

function sanitizeSummary(text: string): string {
  return (
    text
      // 移除 markdown 格式符號
      .replace(/[#*`\[\]()]/g, "")
      // 保留中文、英文、數字、連字號
      .replace(/[^\w\u4e00-\u9fff\u3400-\u4dbf-]/g, "-")
      // 連續連字號合併
      .replace(/-{2,}/g, "-")
      // 去頭尾連字號
      .replace(/^-+|-+$/g, "")
      // 截斷
      .slice(0, 50)
      || "untitled"
  );
}

export function expandHome(p: string): string {
  if (p.startsWith("~/") || p === "~") return join(homedir(), p.slice(1));
  return p;
}
