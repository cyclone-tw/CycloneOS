"use client";

import { useCallback, useMemo, useState } from "react";
import { useAppStore } from "@/stores/app-store";
import { SKILLS } from "@/config/skills-config";
import { SkillCard } from "./skill-card";
import { SkillSearch } from "./skill-search";
import { WorkstationPlaceholder } from "./workstations/workstation-placeholder";
import { DocumentsWorkstation } from "./workstations/documents/documents-workstation";
import { PresentationsWorkstation } from "./workstations/presentations/presentations-workstation";
import { FeloWorkstation } from "./workstations/felo/felo-workstation";
import { TranscribeWorkstation } from "./workstations/transcribe/transcribe-workstation";
import { EducationWorkstation } from "./workstations/education/education-workstation";
import { SocialWorkstation } from "./workstations/social/social-workstation";

export function SkillsPanel() {
  const { activeWorkstation, setActiveWorkstation } = useAppStore();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return SKILLS;
    const q = searchQuery.toLowerCase();
    return SKILLS.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  const handleCardClick = (skillId: string) => {
    const skill = SKILLS.find((s) => s.id === skillId);
    if (!skill) return;
    if (skill.type === "workstation") {
      setActiveWorkstation(skillId);
    }
    // Future: Chat skill → trigger chatCommand in Chat panel
  };

  // Workstation expanded view
  if (activeWorkstation) {
    const skill = SKILLS.find((s) => s.id === activeWorkstation);
    if (!skill) {
      // Invalid workstation ID — render nothing, user can navigate away
      return null;
    }
    if (activeWorkstation === "documents") {
      return <DocumentsWorkstation />;
    }
    if (activeWorkstation === "presentations") {
      return <PresentationsWorkstation />;
    }
    if (activeWorkstation === "felo") {
      return <FeloWorkstation />;
    }
    if (activeWorkstation === "transcribe") {
      return <TranscribeWorkstation />;
    }
    if (activeWorkstation === "education") {
      return <EducationWorkstation />;
    }
    if (activeWorkstation === "social") {
      return <SocialWorkstation />;
    }
    return <WorkstationPlaceholder skill={skill} />;
  }

  // Card catalog view
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-cy-text">Skills</h1>
        <SkillSearch onSearch={handleSearch} />
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-cy-muted">
          找不到符合「{searchQuery}」的技能
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              onClick={() => handleCardClick(skill.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
