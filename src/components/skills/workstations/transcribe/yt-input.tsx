"use client";

import { useState } from "react";
import { Play, Loader2 } from "lucide-react";

interface YtInputProps {
  onSubmit: (url: string) => void;
  disabled?: boolean;
}

export function YtInput({ onSubmit, disabled }: YtInputProps) {
  const [url, setUrl] = useState("");

  const isValid = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|v\/)|youtu\.be\/)/.test(url);

  const handleSubmit = () => {
    if (isValid && !disabled) {
      onSubmit(url);
      setUrl("");
    }
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-cy-text">YouTube 影片連結</label>
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="https://www.youtube.com/watch?v=..."
          className="flex-1 rounded-lg border border-cy-border bg-cy-bg px-3 py-2 text-sm text-cy-text placeholder:text-cy-muted focus:border-cy-accent focus:outline-none"
          disabled={disabled}
        />
        <button
          onClick={handleSubmit}
          disabled={!isValid || disabled}
          className="flex items-center gap-1.5 rounded-lg bg-cy-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-40 hover:bg-cy-accent/90 transition-colors"
        >
          {disabled ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          處理
        </button>
      </div>
    </div>
  );
}
