import {
  BookOpen, PenTool, MessageCircle, Code, GitPullRequest, FlaskConical,
  Search, Terminal, FileEdit, Globe, File,
} from "lucide-react";
import type { ElementType } from "react";

export interface AgentUIEntry {
  name: string;
  icon: ElementType;
  color: string;
}

export const AGENT_UI: Record<string, AgentUIEntry> = {
  researcher:      { name: "Researcher", icon: BookOpen,       color: "text-purple-400" },
  writer:          { name: "Writer",     icon: PenTool,        color: "text-emerald-400" },
  general:         { name: "General",    icon: MessageCircle,  color: "text-cy-accent" },
  coder:           { name: "Coder",      icon: Code,           color: "text-amber-400" },
  "code-reviewer": { name: "Reviewer",   icon: GitPullRequest, color: "text-pink-400" },
  "test-runner":   { name: "Tester",     icon: FlaskConical,   color: "text-sky-400" },
};

export const AGENT_LIST = Object.entries(AGENT_UI).map(([id, ui]) => ({ id, ...ui }));

export const TOOL_ICONS: Record<string, ElementType> = {
  Glob: Search, Grep: Search, Read: BookOpen, Edit: FileEdit,
  Write: FileEdit, Bash: Terminal, WebSearch: Globe, WebFetch: Globe,
};

export const FALLBACK_AGENT_UI: AgentUIEntry = { name: "Agent", icon: File, color: "text-cy-muted" };

export function getAgentUI(agentType: string): AgentUIEntry {
  return AGENT_UI[agentType] ?? FALLBACK_AGENT_UI;
}
