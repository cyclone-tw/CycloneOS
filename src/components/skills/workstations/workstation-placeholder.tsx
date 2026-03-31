"use client";

import { ArrowLeft } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import type { SkillCard } from "@/config/skills-config";

interface WorkstationPlaceholderProps {
  skill: SkillCard;
}

export function WorkstationPlaceholder({ skill }: WorkstationPlaceholderProps) {
  const { setActiveWorkstation } = useAppStore();

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-cy-border pb-3">
        <button
          onClick={() => setActiveWorkstation(null)}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-cy-muted hover:bg-cy-input/50 hover:text-cy-text transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Skills
        </button>
        <span className="text-lg">{skill.icon}</span>
        <h1 className="text-lg font-bold text-cy-text">{skill.name}</h1>
      </div>

      {/* Placeholder content */}
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <span className="text-5xl">{skill.icon}</span>
          <h2 className="mt-4 text-lg font-bold text-cy-text">{skill.name}</h2>
          <p className="mt-2 text-sm text-cy-muted">Coming Soon</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {skill.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-cy-input/50 px-3 py-1 text-xs text-cy-muted"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
