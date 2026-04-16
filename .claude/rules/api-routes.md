---
description: Rules for API route handlers in src/app/api/
globs: src/app/api/**/*.ts
---

# API Route 規範

- `runtime = "nodejs"` + `dynamic = "force-dynamic"`（streaming 必需）
- 長時間操作一律用 SSE streaming（async generator + ReadableStream）
- SSE 格式：`event: {type}\ndata: {JSON}\n\n`
- LLM 呼叫走 `getLLMProvider()`，不直接 import 特定 SDK
- JSON 解析三層 fallback：直接解析 → 去除 fence → 錯誤回報
- 使用 `cleanClaudeOutput()` + `fixJsonControlChars()` 清理 LLM 輸出
- 錯誤回傳統一格式：`{ error: string }`
