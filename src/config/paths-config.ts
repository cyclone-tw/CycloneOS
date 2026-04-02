// src/config/paths-config.ts
//
// 統一管理所有輸出路徑。改路徑只改這裡。
// Google Drive 路徑在所有機器上一致，適合跨裝置同步。

import { join } from "path";
import { homedir } from "os";

// --- Google Drive 根目錄 ---
const GOOGLE_DRIVE_ROOT = join(
  homedir(),
  "Library/CloudStorage/GoogleDrive-user@gmail.com/我的雲端硬碟",
);

// --- CycloneOS 雲端資料夾 ---
const CYCLONEOS_CLOUD = join(GOOGLE_DRIVE_ROOT, "CycloneOS");

// --- 各功能的輸出路徑 ---
export const PATHS = {
  // Felo 生圖
  feloImages: join(CYCLONEOS_CLOUD, "images"),

  // Felo Web Fetch 擷取
  feloWebFetch: join(CYCLONEOS_CLOUD, "web-fetch"),

  // Felo 對話匯出（MD, DOCX, XLSX）
  feloExports: join(CYCLONEOS_CLOUD, "exports"),

  // Documents 工作站輸出
  documents: join(CYCLONEOS_CLOUD, "documents"),

  // 簡報本地存放
  slides: join(CYCLONEOS_CLOUD, "slides"),

  // Google Drive 根（供其他用途）
  googleDrive: GOOGLE_DRIVE_ROOT,
  cycloneosCloud: CYCLONEOS_CLOUD,
} as const;

// --- GitHub 簡報 Repo ---
export const SLIDES_REPO = "cyclone-tw/slides";

// --- Symlink 對應（Next.js 靜態檔案） ---
// public/uploads/felo → CYCLONEOS_CLOUD
// 前端用 /uploads/felo/images/xxx.png 存取
export const UPLOADS_BASE = join(process.cwd(), "public/uploads/felo");

export function expandHome(p: string): string {
  if (p.startsWith("~/") || p === "~") return join(homedir(), p.slice(1));
  return p;
}
