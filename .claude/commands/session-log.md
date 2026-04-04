Generate a session log before ending the conversation.

## 寫入位置

```
~/Library/CloudStorage/GoogleDrive-user@gmail.com/我的雲端硬碟/Obsidian-Cyclone/CycloneOS/sessions/
```

## Filename format

`YYYY-MM-DD-session-<sequential-number>.md`

Check existing files in the directory to determine the next sequential number.

## Session Log Template

```markdown
---
type: session-log
date: YYYY-MM-DD
session: <number>
source: cycloneos
session-type: dev | work
tags: [cycloneos, <相關標籤>]
outputs: [<產出檔案路徑列表>]
knowledge-gained: [<新學到的關鍵知識>]
---

# YYYY-MM-DD Session <number>

## 目標
- （進入 session 時要做什麼）

## 過程摘要
- （按時間順序，重要的討論點和決策）

## 產出清單
- （具體產出的檔案，含完整路徑）

## 決策與判斷
- （為什麼選這個方向、放棄了什麼、取捨原因）

## 知識累積
- （這次 session 學到的新東西）

## 變更清單
- （列出所有被新增/修改/刪除的檔案或設定）

## 待辦 / 下次接續
- （未完成的事項、下個 session 可以接著做的）

## 系統改善建議
- （使用過程中發現 CycloneOS 可以優化的地方）
```

## Session Type 判斷

- **`dev`**：改 CycloneOS 系統本身 — dashboard、腳本、設定、設計文件
- **`work`**：用 CycloneOS 做事 — 簡報、會議紀錄、公文分析、教材、研究

## Rules
- Use Traditional Chinese
- 記錄所有**重要討論與判斷**，不只是程式碼變更
- `決策與判斷` 和 `知識累積` 是最重要的兩個區塊
- 寫完後告知使用者檔案位置
