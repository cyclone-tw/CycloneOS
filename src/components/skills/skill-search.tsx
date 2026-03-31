"use client";

import { useState, useEffect } from "react";
import { Search } from "lucide-react";

interface SkillSearchProps {
  onSearch: (query: string) => void;
}

export function SkillSearch({ onSearch }: SkillSearchProps) {
  const [input, setInput] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => onSearch(input), 200);
    return () => clearTimeout(timer);
  }, [input, onSearch]);

  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-cy-muted" />
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="搜尋技能..."
        className="w-48 rounded-md border border-cy-border bg-cy-input/50 py-1.5 pl-8 pr-3 text-xs text-cy-text placeholder:text-cy-muted focus:border-cy-accent/50 focus:outline-none"
      />
    </div>
  );
}
