"use client";

import { useAppStore, type SidebarPage } from "@/stores/app-store";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { LayoutDashboard, Mail, HardDrive, FileText, Search, ListTodo, Settings, Clock, Sparkles, type LucideIcon } from "lucide-react";

const NAV_ITEMS: { page: SidebarPage; icon: LucideIcon; label: string }[] = [
  { page: "overview", icon: LayoutDashboard, label: "Overview" },
  { page: "gmail", icon: Mail, label: "Gmail" },
  { page: "drive", icon: HardDrive, label: "Drive" },
];

const NAV_AFTER_DOCS: { page: SidebarPage; icon: LucideIcon; label: string }[] = [
  { page: "skills", icon: Sparkles, label: "Skills" },
  { page: "timeline", icon: Clock, label: "Timeline" },
];

const BOTTOM_NAV: { page: SidebarPage; icon: LucideIcon; label: string }[] = [
  { page: "search", icon: Search, label: "Search" },
];

const EXTERNAL_LINKS: { icon: LucideIcon; label: string; url: string }[] = [
  { icon: ListTodo, label: "Tasks (Notion)", url: "https://notion.so" },
];

function NavButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        onClick={onClick}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-md text-lg transition-all duration-200",
          active
            ? "bg-cy-accent/15 text-cy-accent cy-glow"
            : "text-cy-muted hover:bg-cy-input/40 hover:text-cy-text"
        )}
      >
        <Icon className="h-4.5 w-4.5" strokeWidth={1.8} />
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

export function Sidebar() {
  const { activePage, activeWorkstation, setActivePage, navigateTo } = useAppStore();

  // Documents is "active" when skills page has documents workstation open
  const isDocumentsActive = activePage === "skills" && activeWorkstation === "documents";

  return (
    <TooltipProvider delay={0}>
      <div className="flex h-full w-14 flex-col items-center border-r border-cy-border bg-cy-card/80 py-3 gap-1 backdrop-blur-sm">
        {/* Logo */}
        <div className="mb-4 flex h-9 w-9 items-center justify-center">
          <Image src="/logo.png" alt="CycloneOS" width={32} height={32} className="rounded-md" />
        </div>

        {/* Nav before Documents */}
        {NAV_ITEMS.map((item) => (
          <NavButton
            key={item.page}
            icon={item.icon}
            label={item.label}
            active={activePage === item.page}
            onClick={() => setActivePage(item.page)}
          />
        ))}

        {/* Documents shortcut */}
        <NavButton
          icon={FileText}
          label="Documents"
          active={isDocumentsActive}
          onClick={() => navigateTo("skills", "documents")}
        />

        {/* Nav after Documents */}
        {NAV_AFTER_DOCS.map((item) => (
          <NavButton
            key={item.page}
            icon={item.icon}
            label={item.label}
            active={activePage === item.page && (item.page !== "skills" || !activeWorkstation)}
            onClick={() => setActivePage(item.page)}
          />
        ))}

        {/* External Links */}
        <div className="my-2 h-px w-6 bg-cy-border" />
        {EXTERNAL_LINKS.map((link) => (
          <Tooltip key={link.label}>
            <TooltipTrigger
              onClick={() => window.open(link.url, "_blank", "noopener,noreferrer")}
              className="flex h-9 w-9 items-center justify-center rounded-md text-lg text-cy-muted transition-colors hover:bg-cy-input/50 hover:text-cy-text"
            >
              <link.icon className="h-4.5 w-4.5" strokeWidth={1.8} />
            </TooltipTrigger>
            <TooltipContent side="right">{link.label}</TooltipContent>
          </Tooltip>
        ))}

        <div className="flex-1" />

        {/* Bottom Nav */}
        {BOTTOM_NAV.map((item) => (
          <NavButton
            key={item.page}
            icon={item.icon}
            label={item.label}
            active={activePage === item.page}
            onClick={() => setActivePage(item.page)}
          />
        ))}

        {/* Settings — softer styling, no glow */}
        <Tooltip>
          <TooltipTrigger
            onClick={() => setActivePage("settings")}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-md text-lg transition-colors",
              activePage === "settings"
                ? "bg-cy-accent/20 text-cy-accent"
                : "text-cy-muted hover:bg-cy-input/50 hover:text-cy-text"
            )}
          >
            <Settings className="h-4.5 w-4.5" strokeWidth={1.8} />
          </TooltipTrigger>
          <TooltipContent side="right">Settings</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
