---
description: Rules for Zustand stores
globs: src/stores/**/*.ts
---

# Zustand Store 規範

- 命名：`use{Domain}Store`
- 結構：State interface + Actions interface 分開定義
- Immutable updates：用 spread operator，不直接 mutate
- Reset 時清理資源（`URL.revokeObjectURL` 等）
- Getter 少用，mutation 都用明確的 setter
- 一個工作站一個 store，不共用
