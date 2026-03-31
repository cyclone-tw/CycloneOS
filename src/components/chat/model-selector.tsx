"use client";

import { useAgentStore } from "@/stores/agent-store";
import type { ClaudeModel } from "@/types/chat";

const models: { value: ClaudeModel; label: string }[] = [
  { value: "sonnet", label: "Sonnet" },
  { value: "opus", label: "Opus" },
  { value: "haiku", label: "Haiku" },
];

export function ModelSelector() {
  const { model, setModel, tabs, activeTabId } = useAgentStore();
  const isStreaming = tabs.find((t) => t.id === activeTabId)?.status === "streaming";

  return (
    <select
      value={model}
      onChange={(e) => setModel(e.target.value as ClaudeModel)}
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
