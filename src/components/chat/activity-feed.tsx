"use client";

import { File } from "lucide-react";
import { useAgentStore } from "@/stores/agent-store";
import { getAgentUI, TOOL_ICONS } from "@/lib/agent-ui";
import type { ActivityEvent } from "@/types/chat";
// File icon still used for TOOL_ICONS fallback below

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export function ActivityFeed() {
  const { activities, tabs } = useAgentStore();

  // Group activities by agentType
  const grouped = new Map<string, ActivityEvent[]>();
  for (const act of activities) {
    const list = grouped.get(act.agentType) ?? [];
    list.push(act);
    grouped.set(act.agentType, list);
  }

  const activeAgentCount = tabs.filter((t) => t.status === "streaming").length;

  return (
    <div className="flex h-full flex-col border-l border-cy-border bg-cy-bg/60 backdrop-blur-sm">
      <div className="flex items-center gap-2 border-b border-cy-border px-3 py-2">
        <svg className="h-3.5 w-3.5 text-cy-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
        <span className="text-xs font-medium text-cy-text">Activity</span>
        {activeAgentCount > 0 && (
          <span className="rounded-full bg-cy-accent/20 px-1.5 py-0.5 text-[9px] text-cy-accent">
            {activeAgentCount} active
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {activities.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <span className="text-xs text-cy-muted">No activity yet</span>
          </div>
        ) : (
          Array.from(grouped.entries()).map(([agentType, events]) => {
            const ui = getAgentUI(agentType);
            const AgentIcon = ui.icon;
            const tab = tabs.find((t) => t.agentType === agentType);
            return (
              <div key={agentType} className="mb-3">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <AgentIcon className={`h-3.5 w-3.5 ${ui.color}`} strokeWidth={1.8} />
                  <span className="text-xs font-medium text-cy-text">{ui.name}</span>
                  {tab && (
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        tab.status === "streaming" ? "bg-blue-400 animate-pulse" : "bg-emerald-400"
                      }`}
                    />
                  )}
                </div>
                <div className="ml-2 border-l border-white/5 pl-2.5">
                  {events.slice(0, 20).map((event) => {
                    const ToolIcon = TOOL_ICONS[event.toolName] ?? File;
                    return (
                      <div
                        key={event.id}
                        className="group mb-1 flex items-start gap-1.5 rounded px-1 py-0.5 transition-colors hover:bg-cy-input/20"
                      >
                        <ToolIcon className="mt-0.5 h-3 w-3 shrink-0 text-cy-muted" strokeWidth={1.8} />
                        <div className="min-w-0 flex-1">
                          <span className="text-xs text-cy-muted">{event.toolName}</span>
                          {event.toolInput && (
                            <span className="ml-1 truncate text-xs text-cy-text/85">
                              {event.toolInput.slice(0, 60)}
                            </span>
                          )}
                        </div>
                        <span className="shrink-0 text-[9px] text-cy-muted/75">
                          {timeAgo(event.timestamp)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-cy-border px-3 py-1.5">
        <div className="flex items-center justify-between text-[9px] text-cy-muted">
          <span>{activities.length} tool calls</span>
          <span>{activeAgentCount} agents active</span>
        </div>
      </div>
    </div>
  );
}
