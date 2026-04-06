// src/components/skills/workstations/social/source-input.tsx
"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { useSocialStore } from "@/stores/social-store";

type Mode = "direct" | "search";

interface QmdResult {
  title: string;
  snippet: string;
  file: string;
  collection: string;
}

export function SourceInput() {
  const { sourceText, sourceLabel, setSourceText } = useSocialStore();

  const [mode, setMode] = useState<Mode>("direct");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<QmdResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    setSearchError(null);
    setResults([]);
    try {
      const res = await fetch("/api/social/qmd-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });
      const data = (await res.json()) as { results?: QmdResult[]; error?: string };
      if (data.error) {
        setSearchError(data.error);
      } else {
        setResults(data.results ?? []);
        if ((data.results ?? []).length === 0) {
          setSearchError("找不到相關筆記");
        }
      }
    } catch {
      setSearchError("搜尋失敗，請稍後再試");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectResult = async (result: QmdResult) => {
    try {
      const res = await fetch("/api/social/qmd-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: result.file }),
      });
      const data = (await res.json()) as { content?: string; error?: string };
      if (data.content) {
        setSourceText(data.content, result.title);
        setMode("direct");
      } else {
        setSearchError(data.error ?? "無法取得筆記內容");
      }
    } catch {
      setSearchError("載入筆記失敗，請稍後再試");
    }
  };

  const tabBase =
    "px-3 py-1.5 text-sm rounded-md transition-colors font-medium";
  const activeTab = `${tabBase} bg-cy-card text-cy-text shadow-sm`;
  const inactiveTab = `${tabBase} text-cy-muted hover:text-cy-text`;

  return (
    <div className="flex flex-col gap-3">
      {/* Mode toggle */}
      <div className="flex gap-1 rounded-lg bg-cy-input p-1 w-fit">
        <button
          className={mode === "direct" ? activeTab : inactiveTab}
          onClick={() => setMode("direct")}
        >
          直接輸入
        </button>
        <button
          className={mode === "search" ? activeTab : inactiveTab}
          onClick={() => setMode("search")}
        >
          搜尋筆記
        </button>
      </div>

      {mode === "direct" && (
        <div className="flex flex-col gap-1.5">
          {sourceLabel && (
            <p className="text-xs text-cy-muted">
              來自筆記：<span className="text-cy-accent">{sourceLabel}</span>
            </p>
          )}
          <textarea
            className="w-full min-h-[160px] rounded-lg border border-cy-border bg-cy-input px-3 py-2 text-sm text-cy-text placeholder:text-cy-muted resize-y focus:outline-none focus:ring-1 focus:ring-cy-accent"
            placeholder="貼上文章、筆記、會議記錄等素材內容…"
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
          />
          <p className="text-xs text-cy-muted">{sourceText.length} 字</p>
        </div>
      )}

      {mode === "search" && (
        <div className="flex flex-col gap-3">
          {/* Search bar */}
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 rounded-lg border border-cy-border bg-cy-input px-3 py-2 text-sm text-cy-text placeholder:text-cy-muted focus:outline-none focus:ring-1 focus:ring-cy-accent"
              placeholder="搜尋 Obsidian 筆記…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <button
              onClick={handleSearch}
              disabled={isSearching || !query.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-cy-accent px-3 py-2 text-sm text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              <Search className="h-4 w-4" />
              {isSearching ? "搜尋中…" : "搜尋"}
            </button>
          </div>

          {/* Error */}
          {searchError && (
            <p className="text-xs text-cy-error">{searchError}</p>
          )}

          {/* Results */}
          {results.length > 0 && (
            <ul className="flex flex-col gap-1 max-h-64 overflow-y-auto rounded-lg border border-cy-border bg-cy-input divide-y divide-cy-border">
              {results.map((r, i) => (
                <li key={i}>
                  <button
                    onClick={() => handleSelectResult(r)}
                    className="w-full text-left px-3 py-2.5 hover:bg-cy-card transition-colors"
                  >
                    <p className="text-sm font-medium text-cy-text truncate">{r.title}</p>
                    <p className="text-xs text-cy-muted mt-0.5 line-clamp-2">{r.snippet}</p>
                    <p className="text-[10px] text-cy-muted mt-0.5 opacity-70">{r.collection}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
