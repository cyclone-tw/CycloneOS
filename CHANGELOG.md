# CycloneOS Changelog

## 2026-04-02
- Felo AI 工作站上線：SuperAgent 對話、生圖、Web Fetch、快捷入口、產出面板
- Felo 生圖功能：SSE 串流 + LiveDoc polling + 圖片下載到 Google Drive
- Felo 對話匯出：每則訊息可匯出為 MD / DOCX / XLSX，支援自訂指令處理
- Documents 工作站：實作 DOCX、PDF、XLSX 輸出（移除 HTML 簡報和 PPTX）
- 簡報工作站：生圖按鈕（串接式 UI）、URL 智慧偵測、push 到 cyclone-tw/slides
- lib/felo/ API client：search、superagent、web-fetch、livedoc 完整封裝
- felo-output-store：Zustand + localStorage persist 產出管理
- 統一輸出路徑：paths-config.ts 集中管理，MD 存 Obsidian，二進位存 Google Drive
- 統一檔名規則：YYYY-MM-DD-{source}-{summary}.{ext}
- AI Agent 無關性原則寫入 CLAUDE.md
- Computer Use 桌面操控架構設計文件
- IME 注音輸入法相容（compositionstart/end）
- Felo SSE 雙重 JSON 解碼 + 自動重連
