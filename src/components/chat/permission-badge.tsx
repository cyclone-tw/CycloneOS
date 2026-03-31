"use client";

import { useAgentStore } from "@/stores/agent-store";
import type { PermissionMode } from "@/types/chat";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const MODE_CONFIG: Record<PermissionMode, { label: string; color: string }> = {
  acceptEdits: { label: "🟢 Auto Edit", color: "bg-cy-success/20 text-cy-success" },
  bypassPermissions: { label: "🟡 Full Auto", color: "bg-cy-warning/20 text-cy-warning" },
  default: { label: "🔵 Safe", color: "bg-cy-accent/20 text-cy-accent" },
};

const MODES: PermissionMode[] = ["acceptEdits", "default", "bypassPermissions"];

export function PermissionBadge() {
  const { permissionMode, setPermissionMode } = useAgentStore();
  const config = MODE_CONFIG[permissionMode];

  const cycleMode = () => {
    const idx = MODES.indexOf(permissionMode);
    const next = MODES[(idx + 1) % MODES.length];
    if (next === "bypassPermissions") {
      if (!confirm("啟用 Full Auto 模式？這將允許所有操作自動執行，包括 shell 指令。")) return;
    }
    setPermissionMode(next);
  };

  return (
    <Badge
      variant="outline"
      className={cn("cursor-pointer select-none text-xs", config.color)}
      onClick={cycleMode}
    >
      {config.label}
    </Badge>
  );
}
