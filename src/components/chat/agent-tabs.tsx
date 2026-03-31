"use client";

import { Plus, X, History } from "lucide-react";
import { useAgentStore } from "@/stores/agent-store";
import { AGENT_UI, AGENT_LIST } from "@/lib/agent-ui";
import { useState } from "react";

export function AgentTabs() {
  const { tabs, activeTabId, isActivityOpen, addTab, removeTab, setActiveTab, toggleActivity, toggleHistory } = useAgentStore();
  const [pickerOpen, setPickerOpen] = useState(false);

  function handleAddAgent(agentType: string) {
    addTab(agentType);
    setPickerOpen(false);
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-0.5 border-b border-cy-border bg-cy-bg/80 px-1 py-1">
        {tabs.map((tab) => {
          const ui = AGENT_UI[tab.agentType as keyof typeof AGENT_UI];
          if (!ui) return null;
          const Icon = ui.icon;
          const isActive = activeTabId === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`group flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors ${
                isActive
                  ? "bg-cy-input/60 text-cy-text"
                  : "text-cy-muted hover:bg-cy-input/30 hover:text-cy-text"
              }`}
            >
              <span className="relative">
                <Icon className={`h-3.5 w-3.5 ${ui.color}`} strokeWidth={1.8} />
                <span
                  className={`absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full ${
                    tab.status === "streaming"
                      ? "bg-blue-400 animate-pulse"
                      : tab.status === "queued"
                        ? "bg-yellow-400 animate-pulse"
                        : tab.status === "error"
                          ? "bg-red-400"
                          : "bg-emerald-400"
                  }`}
                />
              </span>
              <span>{ui.name}</span>
              {tabs.length > 1 && (
                <X
                  className="h-3 w-3 opacity-0 group-hover:opacity-60 hover:!opacity-100"
                  strokeWidth={1.8}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTab(tab.id);
                  }}
                />
              )}
            </button>
          );
        })}

        <button
          onClick={() => setPickerOpen(!pickerOpen)}
          className="flex items-center justify-center rounded-md p-1 text-cy-muted transition-colors hover:bg-cy-input/30 hover:text-cy-text"
          title="New Agent"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
        </button>

        <div className="flex-1" />

        <button
          onClick={toggleHistory}
          className="rounded-md p-1 text-cy-muted transition-colors hover:bg-cy-input/30 hover:text-cy-text"
          title="Session History"
        >
          <History className="h-3.5 w-3.5" strokeWidth={1.8} />
        </button>

        <button
          onClick={toggleActivity}
          className={`rounded-md p-1 text-xs transition-colors ${
            isActivityOpen
              ? "bg-cy-accent/20 text-cy-accent"
              : "text-cy-muted hover:bg-cy-input/30 hover:text-cy-text"
          }`}
          title="Activity Feed"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        </button>
      </div>

      {pickerOpen && (
        <div className="absolute left-0 right-0 top-full z-50 border-b border-cy-border bg-cy-bg/95 p-2 backdrop-blur-md">
          <div className="grid grid-cols-3 gap-1.5">
            {AGENT_LIST.map((def) => {
              const Icon = def.icon;
              return (
                <button
                  key={def.id}
                  onClick={() => handleAddAgent(def.id)}
                  className="flex flex-col items-center gap-1 rounded-lg border border-white/5 bg-cy-card/60 px-2 py-2.5 transition-all hover:border-cy-accent/30 hover:bg-cy-card"
                >
                  <Icon className={`h-5 w-5 ${def.color}`} strokeWidth={1.8} />
                  <span className="text-xs text-cy-text">{def.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
