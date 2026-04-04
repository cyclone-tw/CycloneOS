"use client";

import { useAgentStore } from "@/stores/agent-store";
import type { AgentCliProvider } from "@/types/chat";

const PROVIDERS: Array<{ value: AgentCliProvider; label: string }> = [
  { value: "claude", label: "Claude CLI" },
  { value: "codex", label: "Codex CLI" },
];

export function ProviderSelector() {
  const { provider, setProvider, tabs, activeTabId } = useAgentStore();
  const isStreaming = tabs.find((t) => t.id === activeTabId)?.status === "streaming";

  return (
    <select
      value={provider}
      onChange={(e) => setProvider(e.target.value as AgentCliProvider)}
      disabled={isStreaming}
      className="rounded bg-cy-bg px-2 py-0.5 text-xs text-cy-muted outline-none transition-colors hover:text-cy-text disabled:opacity-50"
      title="Select CLI provider"
    >
      {PROVIDERS.map((providerOption) => (
        <option key={providerOption.value} value={providerOption.value}>
          {providerOption.label}
        </option>
      ))}
    </select>
  );
}
