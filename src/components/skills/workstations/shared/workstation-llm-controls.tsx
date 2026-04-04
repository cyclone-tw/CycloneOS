"use client";

import { useAgentStore } from "@/stores/agent-store";
import type { AgentCliProvider, AgentModel } from "@/types/chat";

const PROVIDERS: Array<{ value: AgentCliProvider; label: string }> = [
  { value: "claude", label: "Claude CLI" },
  { value: "codex", label: "Codex CLI" },
];

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

export function WorkstationLLMControls() {
  const { provider, model, setProvider, setModel } = useAgentStore();

  return (
    <div className="ml-auto flex items-center gap-2">
      <select
        value={provider}
        onChange={(e) => setProvider(e.target.value as AgentCliProvider)}
        className="rounded bg-cy-bg px-2 py-0.5 text-xs text-cy-muted outline-none transition-colors hover:text-cy-text"
        title="Select CLI provider"
      >
        {PROVIDERS.map((providerOption) => (
          <option key={providerOption.value} value={providerOption.value}>
            {providerOption.label}
          </option>
        ))}
      </select>

      <select
        value={model}
        onChange={(e) => setModel(e.target.value as AgentModel)}
        className="rounded bg-cy-bg px-2 py-0.5 text-xs text-cy-muted outline-none transition-colors hover:text-cy-text"
        title="Select model"
      >
        {MODELS[provider].map((modelOption) => (
          <option key={modelOption.value} value={modelOption.value}>
            {modelOption.label}
          </option>
        ))}
      </select>
    </div>
  );
}
