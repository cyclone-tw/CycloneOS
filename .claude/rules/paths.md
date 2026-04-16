---
description: Rules for file output paths
globs: src/config/paths-config.ts, src/lib/**/*.ts
---

# 路徑管理規範

- 所有輸出路徑統一在 `src/config/paths-config.ts` 管理
- 不要在其他檔案硬寫輸出路徑
- 檔名格式：`YYYY-MM-DD-{source}-{sanitized-summary}.{ext}`
- 使用 `sanitizeSummary()` 處理檔名中的特殊字元
- Markdown → Obsidian Vault
- 二進位（DOCX/XLSX）→ Google Drive
- 圖片 → Google Drive
- 簡報 → Google Drive + GitHub Pages
