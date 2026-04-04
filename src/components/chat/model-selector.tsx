"use client";

import { useAgentStore } from "@/stores/agent-store";
import type { AgentCliProvider, AgentModel } from "@/types/chat";

const MODELS: Record<AgentCliProvider, Array<{ value: AgentModel; label: string }>> = {
  claude: [
    { value: "sonnet", label: "Sonnet" },
    { value: "opus", label: "Opus" },
    { value: "haiku", label: "Haiku" },
  ],
  codex: [
    { value: "gpt-5", label: "GPT-5" },
    { value: "gpt-5-codex", label: "GPT-5 Codex" },
    { value: "gpt-5-mini", label: "GPT-5 Mini" },
  ],
};

export function ModelSelector() {
  const { provider, model, setModel, tabs, activeTabId } = useAgentStore();
  const isStreaming = tabs.find((t) => t.id === activeTabId)?.status === "streaming";
  const models = MODELS[provider];

  return (
    <select
      value={model}
      onChange={(e) => setModel(e.target.value as AgentModel)}
      disabled={isStreaming}
      className="rounded bg-cy-bg px-2 py-0.5 text-xs text-cy-muted outline-none transition-colors hover:text-cy-text disabled:opacity-50"
    >
      {models.map((m) => (
        <option key={m.value} value={m.value}>
          {m.label}
        </option>
      ))}
    </select>
  );
}
