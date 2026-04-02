"use client";

interface FeloShortcutsProps {
  onSelect: (prompt: string) => void;
}

const SHORTCUTS = [
  { icon: "🎨", label: "生圖", prompt: "幫我生成一張圖片：" },
  { icon: "🔗", label: "擷取 URL", prompt: "擷取這個網頁的內容：" },
  { icon: "🔍", label: "Research", prompt: "搜尋並整理以下主題：" },
  { icon: "✏️", label: "Logo", prompt: "設計一個 logo：" },
];

export function FeloShortcuts({ onSelect }: FeloShortcutsProps) {
  return (
    <div className="flex gap-1.5 px-3 py-2 border-b border-cy-border/30 bg-cy-bg/50">
      {SHORTCUTS.map((s) => (
        <button
          key={s.label}
          onClick={() => onSelect(s.prompt)}
          className="flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-1 text-[11px] text-purple-300 hover:bg-purple-500/20 transition-colors"
        >
          <span>{s.icon}</span>
          {s.label}
        </button>
      ))}
    </div>
  );
}
