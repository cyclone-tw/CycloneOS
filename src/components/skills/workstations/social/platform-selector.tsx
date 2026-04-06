// src/components/skills/workstations/social/platform-selector.tsx
"use client";

import { useSocialStore } from "@/stores/social-store";
import type { Platform, Tone } from "@/lib/social/prompts";

const PLATFORMS: { id: Platform; label: string; emoji: string }[] = [
  { id: "fb", label: "Facebook", emoji: "📘" },
  { id: "ig", label: "Instagram", emoji: "📸" },
  { id: "line", label: "LINE", emoji: "💬" },
  { id: "school", label: "學校網站", emoji: "🏫" },
  { id: "notion", label: "Notion", emoji: "📝" },
];

const TONES: { id: Tone; label: string }[] = [
  { id: "knowledge", label: "知識分享" },
  { id: "casual", label: "日常" },
  { id: "promotion", label: "活動宣傳" },
];

interface PlatformSelectorProps {
  onGenerate: () => void;
  disabled?: boolean;
}

export function PlatformSelector({ onGenerate, disabled }: PlatformSelectorProps) {
  const { platforms, tone, togglePlatform, setTone, sourceText, isGenerating } = useSocialStore();

  const canGenerate = !isGenerating && sourceText.trim().length > 0 && !disabled;

  const toggleBase =
    "rounded-lg border px-3 py-2 text-sm font-medium transition-colors";
  const activeToggle = `${toggleBase} border-cy-accent bg-cy-accent/10 text-cy-accent`;
  const inactiveToggle = `${toggleBase} border-cy-border bg-cy-input text-cy-muted hover:border-cy-accent/50 hover:text-cy-text`;

  return (
    <div className="flex flex-col gap-4">
      {/* Platform checkboxes */}
      <div>
        <p className="mb-2 text-xs font-semibold text-cy-muted uppercase tracking-wide">平台</p>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map(({ id, label, emoji }) => (
            <button
              key={id}
              onClick={() => togglePlatform(id)}
              className={platforms.includes(id) ? activeToggle : inactiveToggle}
            >
              {emoji} {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tone selector */}
      <div>
        <p className="mb-2 text-xs font-semibold text-cy-muted uppercase tracking-wide">語氣</p>
        <div className="flex flex-wrap gap-2">
          {TONES.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTone(id)}
              className={tone === id ? activeToggle : inactiveToggle}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={onGenerate}
        disabled={!canGenerate}
        className="w-full rounded-lg bg-cy-accent px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isGenerating ? "生成中…" : "✨ 生成貼文"}
      </button>
    </div>
  );
}
