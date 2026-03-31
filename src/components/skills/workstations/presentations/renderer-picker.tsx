"use client";
import { Monitor, Palette, FileText } from "lucide-react";
import { usePresentationsStore, type RendererType } from "@/stores/presentations-store";

const RENDERERS: { id: RendererType; name: string; icon: typeof Monitor; enabled: boolean; description: string }[] = [
  { id: "html", name: "HTML", icon: Monitor, enabled: true, description: "自建引擎" },
  { id: "canva", name: "Canva", icon: Palette, enabled: false, description: "精美設計（即將推出）" },
  { id: "felo", name: "Felo PPT", icon: FileText, enabled: false, description: "快速 PPT（即將推出）" },
];

export function RendererPicker() {
  const { getActiveSession, setRenderer } = usePresentationsStore();
  const session = getActiveSession();
  const current = session?.renderer ?? "html";

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-cy-muted">輸出引擎</label>
      <div className="space-y-1">
        {RENDERERS.map(({ id, name, icon: Icon, enabled, description }) => (
          <button
            key={id}
            onClick={() => enabled && setRenderer(id)}
            disabled={!enabled}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              current === id
                ? "bg-cy-accent/15 text-cy-accent border border-cy-accent/30"
                : enabled
                ? "bg-cy-input/50 text-cy-text hover:bg-cy-input border border-transparent"
                : "bg-cy-input/20 text-cy-muted/50 cursor-not-allowed border border-transparent"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <div className="text-left">
              <div className="font-medium">{name}</div>
              <div className="text-xs text-cy-muted">{description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
