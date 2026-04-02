"use client";

import { Trash2 } from "lucide-react";
import { useFeloOutputStore } from "@/stores/felo-output-store";

export function FeloOutputPanel() {
  const { outputs, removeOutput, liveDocId } = useFeloOutputStore();
  const recent = outputs.slice(0, 30);

  const typeIcon = (type: string) => {
    switch (type) {
      case "image": return "🖼️";
      case "document": return "📄";
      case "web-fetch": return "🔗";
      default: return "📎";
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-3">
        <h3 className="mb-2 text-xs font-medium text-cy-muted">產出檔案</h3>
        {recent.length === 0 ? (
          <p className="py-8 text-center text-xs text-cy-muted/50">
            尚無產出
          </p>
        ) : (
          <div className="space-y-1.5">
            {recent.map((o) => (
              <div
                key={o.id}
                className="flex items-center gap-2 rounded-lg bg-cy-input/30 p-2 group"
              >
                <span className="text-base">{typeIcon(o.type)}</span>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs text-cy-text">
                    {o.localPath.split("/").pop()}
                  </p>
                  <p className="truncate text-[10px] text-cy-muted">
                    {o.prompt || o.sourceUrl || o.type}
                  </p>
                </div>
                <button
                  onClick={() => removeOutput(o.id)}
                  className="opacity-0 group-hover:opacity-100 text-cy-muted hover:text-cy-error transition-all"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-cy-border/30 p-3">
        <h3 className="mb-1 text-xs font-medium text-cy-muted">LiveDoc</h3>
        {liveDocId ? (
          <div className="text-[10px] text-cy-muted">
            <p>ID: {liveDocId.slice(0, 12)}...</p>
            <a
              href={`https://felo.ai/livedoc/${liveDocId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300"
            >
              在 Felo 開啟 ↗
            </a>
          </div>
        ) : (
          <p className="text-[10px] text-cy-muted/50">尚未建立</p>
        )}
      </div>
    </div>
  );
}
