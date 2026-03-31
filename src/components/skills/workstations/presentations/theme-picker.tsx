"use client";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { PRESENTATION_THEMES, THEME_CATEGORIES, type ThemeCategory } from "@/lib/presentation-themes";
import { usePresentationsStore } from "@/stores/presentations-store";

export function ThemePicker() {
  const { getActiveSession, setTheme } = usePresentationsStore();
  const session = getActiveSession();
  const currentTheme = session?.outline.theme;

  const [expandedCategories, setExpandedCategories] = useState<Set<ThemeCategory>>(new Set());

  const toggleCategory = (cat: ThemeCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  const handleSelectTheme = (themeId: string) => {
    if (!session) return;
    setTheme(themeId);
  };

  const categoryKeys = Object.keys(THEME_CATEGORIES) as ThemeCategory[];

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-cy-muted">投影片主題</label>
      <div className="space-y-0.5">
        {categoryKeys.map((cat) => {
          const themesInCat = PRESENTATION_THEMES.filter((t) => t.category === cat);
          const isExpanded = expandedCategories.has(cat);
          const hasSelected = themesInCat.some((t) => t.id === currentTheme);

          return (
            <div key={cat}>
              {/* Category header */}
              <button
                onClick={() => toggleCategory(cat)}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-colors ${
                  hasSelected
                    ? "text-cy-accent font-medium"
                    : "text-cy-muted hover:text-cy-text hover:bg-cy-input/30"
                }`}
              >
                <span>{THEME_CATEGORIES[cat]}</span>
                <span className="flex items-center gap-1 shrink-0">
                  {hasSelected && (
                    <span className="text-[10px] text-cy-accent">
                      {themesInCat.find((t) => t.id === currentTheme)?.nameZh}
                    </span>
                  )}
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </span>
              </button>

              {/* Theme grid */}
              {isExpanded && (
                <div className="grid grid-cols-2 gap-1 pl-2 pb-1.5 pt-0.5">
                  {themesInCat.map((theme) => {
                    const isSelected = theme.id === currentTheme;
                    const accentColor = theme.colors.accent.startsWith("linear")
                      ? "#888"
                      : theme.colors.accent;

                    return (
                      <button
                        key={theme.id}
                        onClick={() => handleSelectTheme(theme.id)}
                        title={theme.name}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-left transition-colors ${
                          isSelected
                            ? "bg-cy-accent/15 border border-cy-accent/30 text-cy-accent"
                            : "bg-cy-input/30 border border-transparent hover:bg-cy-input/50 text-cy-text"
                        }`}
                      >
                        {/* Color swatch */}
                        <span
                          className="inline-block h-3 w-3 rounded-full shrink-0 border border-white/10"
                          style={{ backgroundColor: accentColor }}
                        />
                        {/* Theme name */}
                        <span className="truncate text-xs leading-tight">{theme.nameZh}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
