"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { EDUCATION_MODULES, type EducationModule } from "@/config/education-modules";
import { SpcMeetingPanel } from "./spc-meeting/spc-meeting-panel";

export function EducationWorkstation() {
  const { setActiveWorkstation } = useAppStore();
  const [activeModule, setActiveModule] = useState<string | null>(null);

  if (activeModule === "spc-meeting") {
    return <SpcMeetingPanel onBack={() => setActiveModule(null)} />;
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 5.5rem)" }}>
      <div className="flex items-center gap-3 border-b border-cy-border pb-3">
        <button
          onClick={() => setActiveWorkstation(null)}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-cy-muted hover:bg-cy-input/50 hover:text-cy-text transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Skills
        </button>
        <span className="text-lg">🎓</span>
        <h1 className="text-lg font-bold text-cy-text">教育工作站</h1>
      </div>

      <div className="flex-1 overflow-y-auto py-6">
        <div className="w-full px-2">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {EDUCATION_MODULES.map((mod) => (
              <ModuleCard
                key={mod.id}
                module={mod}
                onClick={() => mod.status === "active" && setActiveModule(mod.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ModuleCard({ module, onClick }: { module: EducationModule; onClick: () => void }) {
  const isActive = module.status === "active";

  return (
    <button
      onClick={onClick}
      disabled={!isActive}
      className={`rounded-lg border p-4 text-left transition-colors ${
        isActive
          ? "border-cy-border bg-cy-card hover:border-cy-accent hover:bg-cy-card/80 cursor-pointer"
          : "border-cy-border/50 bg-cy-card/30 opacity-50 cursor-default"
      }`}
    >
      <span className="text-2xl">{module.icon}</span>
      <h3 className="mt-2 text-sm font-bold text-cy-text">{module.name}</h3>
      <p className="mt-1 text-xs text-cy-muted">{module.description}</p>
      {!isActive && (
        <p className="mt-2 text-[10px] text-cy-muted">即將推出</p>
      )}
    </button>
  );
}
