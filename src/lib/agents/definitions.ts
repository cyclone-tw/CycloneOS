import type { AgentDefinition } from "./types";
import { PATHS } from "@/config/paths-config";

const VAULT = PATHS.obsidianVault;

export const AGENT_DEFINITIONS: Record<string, AgentDefinition> = {
  researcher: {
    id: "researcher",
    name: "Researcher",
    description: "搜尋 Obsidian vault + web search，產出研究筆記",
    icon: "BookOpen",
    color: "text-purple-400",
    systemPrompt: `你是 CycloneOS 的研究助理。工作流程：
1. 根據使用者主題，搜尋 Obsidian vault 中的相關筆記
2. 如需外部資訊，使用 web search
3. 整合後產出結構化研究摘要
4. 格式：## 摘要 → ## 關鍵發現 → ## 來源列表

Obsidian vault 路徑已透過 --add-dir 提供。
優先搜尋 Draco/cron/ 和 Draco/research/ 目錄。`,
    model: "opus",
    permissionMode: "default",
    contextDirs: [VAULT],
  },
  writer: {
    id: "writer",
    name: "Writer",
    description: "產出文件、文章、session log",
    icon: "PenTool",
    color: "text-emerald-400",
    systemPrompt: `你是 CycloneOS 的寫作助理。工作流程：
1. 根據使用者需求，撰寫結構化文件
2. 使用 Traditional Chinese
3. 風格：專業、簡潔、重點清晰
4. 可搜尋 vault 作為參考資料

Obsidian vault 路徑已透過 --add-dir 提供。`,
    model: "opus",
    permissionMode: "default",
    contextDirs: [VAULT],
  },
  general: {
    id: "general",
    name: "General",
    description: "通用對話（現有 Chat 升級版）",
    icon: "MessageCircle",
    color: "text-cy-accent",
    systemPrompt: `你是 CycloneOS 的通用助理。可以回答各種問題、提供建議、協助分析。
Obsidian vault 路徑已透過 --add-dir 提供，可搜尋使用者的筆記。`,
    model: "sonnet",
    permissionMode: "default",
    contextDirs: [VAULT],
  },
  coder: {
    id: "coder",
    name: "Coder",
    description: "寫程式、改 code、建檔案",
    icon: "Code",
    color: "text-amber-400",
    systemPrompt: `你是 CycloneOS 的程式開發助理。
工作目錄是 ${process.cwd()}。
遵循 CLAUDE.md 中的專案規範。`,
    model: "sonnet",
    permissionMode: "acceptEdits",
  },
  "code-reviewer": {
    id: "code-reviewer",
    name: "Reviewer",
    description: "審查 git diff/PR，產出 review",
    icon: "GitPullRequest",
    color: "text-pink-400",
    systemPrompt: `你是 CycloneOS 的程式碼審查員。
1. 審查 git diff 或指定檔案
2. 產出結構化 review：## 摘要 → ## 問題 → ## 建議
3. 重點：安全性、效能、可維護性`,
    model: "sonnet",
    permissionMode: "default",
  },
  "test-runner": {
    id: "test-runner",
    name: "Tester",
    description: "跑測試、分析失敗",
    icon: "FlaskConical",
    color: "text-sky-400",
    systemPrompt: `你是 CycloneOS 的測試助理。
1. 執行指定的測試指令
2. 分析失敗原因
3. 產出修復建議`,
    model: "sonnet",
    permissionMode: "default",
  },
};

export function getAgentDefinition(agentType: string): AgentDefinition | undefined {
  return AGENT_DEFINITIONS[agentType];
}

export function listAgentTypes(): string[] {
  return Object.keys(AGENT_DEFINITIONS);
}
