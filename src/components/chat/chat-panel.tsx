"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAgentStore } from "@/stores/agent-store";
import type { ChatMessage } from "@/types/chat";
import { MessageList } from "./message-list";
import { InputBar } from "./input-bar";
import { AgentTabs } from "./agent-tabs";
import { ActivityFeed } from "./activity-feed";

export function ChatPanel() {
  const {
    tabs, activeTabId, isActivityOpen, messagesByTab,
    addMessage: addAgentMessage, appendToLastAssistant: appendAgentText,
    setTabStatus, setTabProcessId, setTabSessionId, addActivity,
  } = useAgentStore();

  const [claudeOk, setClaudeOk] = useState(true);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const isStreaming = activeTab?.status === "streaming";

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setClaudeOk(d.claude))
      .catch(() => setClaudeOk(false));
  }, []);

  const handleStop = useCallback(() => {
    const tab = useAgentStore.getState().tabs.find(
      (t) => t.id === useAgentStore.getState().activeTabId
    );
    if (tab?.processId) {
      fetch("/api/agents/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processId: tab.processId }),
      }).catch(() => {});
    }

    if (readerRef.current) {
      readerRef.current.cancel().catch(() => {});
      readerRef.current = null;
    }
    const tabId = useAgentStore.getState().activeTabId;
    appendAgentText(tabId, "\n\n_(interrupted)_");
    setTabStatus(tabId, "idle");
    setTabProcessId(tabId, null);
  }, [appendAgentText, setTabStatus, setTabProcessId]);

  const handleSend = useCallback(
    async (text: string, files?: import("@/types/chat").FileAttachment[]) => {
      const tabId = useAgentStore.getState().activeTabId;
      const tab = useAgentStore.getState().tabs.find((t) => t.id === tabId);
      if (!tab) return;

      // Build prompt with file paths so Claude can Read them
      let prompt = text;
      if (files?.length) {
        const uploadedFiles = files.filter((f) => f.tempPath);
        if (uploadedFiles.length > 0) {
          const pathList = uploadedFiles
            .map((f) => `- ${f.tempPath} (${f.name}, ${f.mimeType})`)
            .join("\n");
          prompt = prompt
            ? `${prompt}\n\n[附加檔案，請用 Read tool 查看]\n${pathList}`
            : `請查看以下檔案：\n${pathList}`;
        }
      }

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        timestamp: Date.now(),
        ...(files?.length ? { files } : {}),
      };
      addAgentMessage(tabId, userMsg);

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        timestamp: Date.now(),
      };
      addAgentMessage(tabId, assistantMsg);
      setTabStatus(tabId, "streaming");

      try {
        const res = await fetch("/api/agents/dispatch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentType: tab.agentType,
            prompt,
            sessionId: tab.sessionId,
          }),
        });

        if (!res.ok || !res.body) {
          appendAgentText(tabId, `Error: ${res.status} ${res.statusText}`);
          setTabStatus(tabId, "error");
          return;
        }

        const reader = res.body.getReader();
        readerRef.current = reader;
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") break;

            try {
              const event = JSON.parse(data);
              switch (event.type) {
                case "process":
                  setTabProcessId(tabId, event.processId);
                  break;
                case "queued":
                  setTabStatus(tabId, "queued");
                  break;
                case "text": {
                  // If tab was queued, transition to streaming on first text
                  const curTab = useAgentStore.getState().tabs.find((t) => t.id === tabId);
                  if (curTab?.status === "queued") setTabStatus(tabId, "streaming");
                  appendAgentText(tabId, event.content);
                  break;
                }
                case "tool_use":
                  addActivity({
                    id: crypto.randomUUID(),
                    processId: event.processId ?? "",
                    agentType: tab.agentType,
                    toolName: event.toolName,
                    toolInput: event.toolInput,
                    timestamp: event.timestamp,
                  });
                  break;
                case "session":
                  if (event.sessionId) {
                    setTabSessionId(tabId, event.sessionId);
                  }
                  break;
                case "error":
                  appendAgentText(tabId, `\n\nError: ${event.content}`);
                  setTabStatus(tabId, "error");
                  break;
              }
            } catch {
              // Not JSON, skip
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          appendAgentText(tabId, `\n\nConnection error: ${String(err)}`);
        }
      } finally {
        readerRef.current = null;
        // Preserve error status — only reset to idle if not already errored
        const currentTab = useAgentStore.getState().tabs.find((t) => t.id === tabId);
        if (currentTab?.status !== "error") {
          setTabStatus(tabId, "idle");
        }
        setTabProcessId(tabId, null);
      }
    },
    [addAgentMessage, appendAgentText, setTabStatus, setTabProcessId, setTabSessionId, addActivity]
  );

  const messages = messagesByTab[activeTabId] ?? [];

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col bg-cy-card/60 backdrop-blur-sm">
        <AgentTabs />
        {!claudeOk && (
          <div className="border-b border-cy-border bg-red-500/5 px-3 py-1">
            <span className="text-xs text-red-400">● Claude CLI unavailable</span>
          </div>
        )}
        <MessageList messages={messages} isStreaming={isStreaming} />
        <InputBar
          onSend={handleSend}
          onStop={handleStop}
          isStreaming={isStreaming}
        />
      </div>

      {isActivityOpen && (
        <div className="w-52 shrink-0">
          <ActivityFeed />
        </div>
      )}
    </div>
  );
}
