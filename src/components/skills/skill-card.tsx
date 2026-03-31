"use client";

import type { SkillCard as SkillCardType } from "@/config/skills-config";
import { ArrowRight, MessageSquare } from "lucide-react";

interface SkillCardProps {
  skill: SkillCardType;
  onClick: () => void;
}

export function SkillCard({ skill, onClick }: SkillCardProps) {
  const isWorkstation = skill.type === "workstation";

  return (
    <button
      onClick={onClick}
      className="cy-glass-card group flex flex-col gap-4 rounded-xl p-5 text-left"
    >
      {/* Accent glow — appears on hover */}
      <div className="pointer-events-none absolute -top-20 -right-20 z-0 h-44 w-44 rounded-full bg-cy-accent/[0.04] blur-3xl transition-all duration-500 group-hover:bg-cy-accent/[0.1]" />

      <div className="relative z-[3] flex items-start justify-between">
        <span className="text-3xl drop-shadow-lg">{skill.icon}</span>
        <span
          className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm ${
            isWorkstation
              ? "bg-cy-accent/[0.12] text-cy-accent border border-cy-accent/20"
              : "bg-blue-500/[0.12] text-blue-400 border border-blue-500/20"
          }`}
        >
          {isWorkstation ? (
            <>
              展開 <ArrowRight className="h-2.5 w-2.5" />
            </>
          ) : (
            <>
              <MessageSquare className="h-2.5 w-2.5" /> Chat
            </>
          )}
        </span>
      </div>
      <div className="relative z-[3]">
        <h3 className="text-sm font-bold text-cy-text group-hover:text-cy-accent transition-colors duration-300">
          {skill.name}
        </h3>
        <p className="mt-1.5 text-xs text-cy-muted/80 leading-relaxed">
          {skill.description}
        </p>
      </div>
    </button>
  );
}
