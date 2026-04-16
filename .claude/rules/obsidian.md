---
description: Rules for reading/writing Obsidian Vault files
globs: src/lib/**/*.ts, scripts/**/*.py
---

# Obsidian Vault 操作規範

- Vault 路徑從 `~/.cyclone/config.json` 的 `paths.vault` 讀取
- Google Drive CloudStorage 路徑禁用 Bash `ls`/`find`（會 timeout）
- 一律用 Glob + Write/Read 操作
- Markdown frontmatter 用 YAML 格式
- 內部連結用 `[[wiki link]]` 語法
- PII 資料只存 Obsidian（不對外），對外分發版要 mask
