Generate a handoff prompt for the next session.

You MUST do both:

1. **在對話中輸出 prompt** — 讓使用者可以直接複製貼上
2. **寫入 CLAUDE.md 的 `🔜 Next Session` 區塊** — 讓新 session 的 Claude 也能看到

## 區塊格式

```markdown
## 🔜 Next Session: <簡短標題>

> 複製以下內容作為新 session 的第一句話，然後刪除此區塊。

\`\`\`
<handoff prompt 內容>
\`\`\`
```

## Rules
- 新 session 開始執行後，**必須刪除此區塊**
- 如果已有舊的 `🔜 Next Session` 區塊，直接覆蓋
- prompt 要包含足夠 context 讓新 session 不需要回頭翻 session log
